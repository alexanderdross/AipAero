import datetime
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "LV"
# LGS lists the published editions on a PUBLIC page (probe_eaip run
# 29258057165; the login redirect only guards other AIS portal areas):
#   AIRAC AMDT 005/2026 -> /eAIPfiles/2026_005_09-JUL-2026/data/2026-07-09/html/index.html
# We pick the latest edition whose embedded effective date is on or before
# today (same approach as NL/UK) and walk the eurocontrol frame chain.
ROOT_URL = "https://ais.lgs.lv/aiseaip"

_EDITION_DATE_RE = re.compile(r"/data/(\d{4})-(\d{2})-(\d{2})/html/index[^/]*\.html", re.I)

_AD2_SECTION_IDS = ["AD 2en-GBdetails", "AD-2details", "AD 2details"]
_AD3_SECTION_IDS = ["AD 3en-GBdetails", "AD-3details", "AD 3details"]


class LV(HttpEurocontrolBase):
    """Latvia AIP crawler (LGS eAIP, task spec: europe-expansion.md).

    The /aiseaip listing links each AMDT's eurocontrol frameset entry with
    the effective date embedded in the URL. Aerodromes are emitted as "vfr"
    (NO/PL/SE convention), heliports fail-soft as "heliport".
    """

    # Chart-PDF extraction (recon run 29264498572, crawlers/recon/
    # pdf-recon-batch1.md): positional AD 2.24 numbering, e.g.
    # 1616_EVAD_2_24_1_20250710.pdf - chart 24_1 is the aerodrome
    # chart on every sampled field, 24_14 the VAC candidate (present
    # on EVAD/EVCA/EVGA; promote it to the front once verified).
    FETCH_PDF_URLS = True
    PDF_HREF_PRIORITY = (r"_2_24_1_\d{8}\.pdf$", r"_2_24_14_\d{8}\.pdf$")

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _resolve_edition_url(
        self, html: str, today: datetime.date | None = None
    ) -> str:
        today = today or datetime.date.today()
        soup = self.soup(html)
        candidates: list[tuple[datetime.date, str]] = []
        for a in soup.find_all("a", href=True):
            m = _EDITION_DATE_RE.search(a["href"])
            if not m:
                continue
            year, month, day = (int(g) for g in m.groups())
            try:
                effective = datetime.date(year, month, day)
            except ValueError:
                continue
            candidates.append(
                (effective, urljoin(ROOT_URL, a["href"].strip()))
            )
        if not candidates:
            raise ValueError(f"No eAIP edition links found in {ROOT_URL}")
        in_effect = [c for c in candidates if c[0] <= today]
        effective, url = (
            max(in_effect, key=lambda c: c[0])
            if in_effect
            else min(candidates, key=lambda c: c[0])
        )
        self.logger.info(f"LV edition (effective {effective}): {url}")
        return url

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            listing_html = self.fetch(ROOT_URL)
            last_html = listing_html
            edition_url = self._resolve_edition_url(listing_html)

            # LGS serves a SINGLE-LEVEL frameset (frames eAISCommands /
            # eAISNavigation / eAISContent - live run 29258921401), unlike
            # the two-level eAISNavigationBase layout of NL/UK/CZ. Prefer
            # the English frameset sibling of the bare index; try the short
            # chain first, keep the two-level chain as fallback.
            nav_url = nav_html = None
            frame_error: Exception | None = None
            for entry in (
                urljoin(edition_url, "index-en-GB.html"),
                edition_url,
            ):
                for chain in (
                    ["eAISNavigation"],
                    ["eAISNavigationBase", "eAISNavigation"],
                ):
                    try:
                        nav_url, nav_html = self.follow_frame_chain(entry, chain)
                        break
                    except Exception as e:  # 404 or missing frame - next try
                        frame_error = e
                if nav_html is not None:
                    break
            if nav_html is None:
                assert frame_error is not None
                raise frame_error
            last_url, last_html = nav_url, nav_html

            airports.extend(
                self._extract_section(nav_html, nav_url, _AD2_SECTION_IDS, "vfr")
            )
            try:
                airports.extend(
                    self._extract_section(
                        nav_html, nav_url, _AD3_SECTION_IDS, "heliport"
                    )
                )
            except ValueError:
                self.logger.info("LV: no AD 3 heliport section - skipping")

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"LV crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports

    def _extract_section(
        self,
        nav_html: str,
        nav_url: str,
        id_candidates: list[str],
        category: str,
    ) -> list[Airport]:
        """Extract a menu section, trying each candidate id format in turn."""
        last_error: Exception | None = None
        for menu_id in id_candidates:
            try:
                return self.extract_airports_from_html(
                    nav_html, nav_url, menu_id, category  # type: ignore[arg-type]
                )
            except ValueError as e:
                last_error = e
        assert last_error is not None
        raise last_error
