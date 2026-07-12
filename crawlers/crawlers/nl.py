import datetime
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "NL"
ROOT_URL = "https://eaip.lvnl.nl/web/eaip/default.html"

# LVNL's default.html lists the currently effective edition, the next
# issue(s) and archived ones, each linking to a dated edition folder:
#   `AIRAC AMDT 06-2026_2026_06_11\index.html`
# Note (a) the embedded effective date `YYYY_MM_DD` right before the index
# file, and (b) the Windows-style backslash separator (plus spaces). We pick
# the edition by date — the latest whose effective date is on or before today,
# like the UK crawler — and normalise the backslash to "/": browsers do that
# implicitly, httpx does not, so a raw backslash would be percent-encoded into
# a 404 URL.
_EDITION_DATE_RE = re.compile(r"(\d{4})_(\d{2})_(\d{2})[\\/]index[^\\/]*\.html", re.I)
# Fallbacks for an older single-edition layout that links or redirects to a
# bare / locale-suffixed index instead of dated editions.
_EDITION_HREF_RE = re.compile(r"index(?:[-_][A-Za-z]{2}-[A-Za-z]{2})?\.html$", re.I)
_META_REFRESH_URL_RE = re.compile(r"url=([^;]+)", re.I)
_JS_LOCATION_RE = re.compile(r"""location(?:\.href)?\s*=\s*['"]([^'"]+)['"]""", re.I)


class NL(HttpEurocontrolBase):
    """Netherlands AIP crawler.

    LVNL's eAIP is a static eurocontrol-style frameset. `default.html` lists
    several dated AIRAC editions (currently effective + next + archived);
    each links to `AIRAC AMDT NN-YYYY_YYYY_MM_DD\\index.html`:

        default.html
            └─ pick edition by effective date (latest on/before today)
                └─ <edition>/index.html
                    └─ frameset
                        └─ frame name=eAISNavigationBase
                            └─ frame name=eAISNavigation  ← the menu we parse

    No JS execution is needed — every step resolves to a plain HTML doc.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _resolve_edition_url(
        self,
        base_url: str,
        html: str,
        today: datetime.date | None = None,
    ) -> str:
        """Find the current effective edition entry point in default.html.

        Primary path: read the effective date embedded in each dated edition
        link and return the latest edition already in effect on ``today``
        (falling back to the earliest listed edition if — unexpectedly —
        every edition is still in the future). Windows-style backslash
        separators are normalised to "/" so httpx builds a valid URL.

        Fallbacks, for an older single-edition layout: the first bare /
        locale-suffixed `index*.html` link, then a `<meta refresh>` redirect,
        then a `location = "…"` JS redirect (which Selenium used to follow
        transparently but httpx does not).
        """
        today = today or datetime.date.today()
        soup = self.soup(html)

        dated: list[tuple[datetime.date, str]] = []
        for a in soup.find_all("a", href=True):
            m = _EDITION_DATE_RE.search(a["href"])
            if not m:
                continue
            year, month, day = (int(g) for g in m.groups())
            try:
                effective = datetime.date(year, month, day)
            except ValueError:
                continue
            href = a["href"].replace("\\", "/")
            dated.append((effective, urljoin(base_url, href)))

        if dated:
            in_effect = [c for c in dated if c[0] <= today]
            effective_date, edition_url = (
                max(in_effect, key=lambda c: c[0])
                if in_effect
                else min(dated, key=lambda c: c[0])
            )
            self.logger.info(
                f"Current AIRAC edition (effective {effective_date.isoformat()}): "
                f"{edition_url}"
            )
            return edition_url

        # --- fallbacks: single-edition / redirect layouts --------------------
        for a in soup.find_all("a", href=True):
            href = a["href"].replace("\\", "/")
            if _EDITION_HREF_RE.search(href.split("?")[0].split("#")[0]):
                return urljoin(base_url, href)

        meta = soup.find(
            "meta", attrs={"http-equiv": re.compile("refresh", re.I)}
        )
        if meta and meta.get("content"):
            m = _META_REFRESH_URL_RE.search(meta["content"])
            if m:
                return urljoin(base_url, m.group(1).strip().strip("'\""))

        m = _JS_LOCATION_RE.search(html)
        if m:
            return urljoin(base_url, m.group(1))

        raise ValueError(
            f"Could not resolve current-edition link/redirect in {base_url}"
        )

    # Chart-PDF extraction (recon 2026-07-12): each AD page links 1-2 PDFs,
    # EHxx-VFR-PROC.pdf is the visual procedures chart - exactly our target.
    FETCH_PDF_URLS = True
    PDF_HREF_PRIORITY = (r"-VFR-PROC\.pdf$",)

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. Resolve the currently effective edition (by AIRAC date).
            default_html = self.fetch(ROOT_URL)
            last_url, last_html = ROOT_URL, default_html

            edition_url = self._resolve_edition_url(ROOT_URL, default_html)

            # 2. Walk the frame chain to the navigation HTML.
            nav_url, nav_html = self.follow_frame_chain(
                edition_url, ["eAISNavigationBase", "eAISNavigation"]
            )
            last_url, last_html = nav_url, nav_html

            # 3. Extract aerodromes (AD 2) and heliports (AD 3).
            airports.extend(
                self.extract_airports_from_html(
                    nav_html, nav_url, "AD 2en-GBdetails", "vfr"
                )
            )
            airports.extend(
                self.extract_airports_from_html(
                    nav_html, nav_url, "AD 3en-GBdetails", "heliport"
                )
            )

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"NL crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
