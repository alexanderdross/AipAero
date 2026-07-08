import datetime
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "NO"
# Avinor / IPPC eAIP entry point. BEST-EFFORT — see the class docstring:
# this URL is unverified and almost certainly needs adjusting once the live
# structure of the Avinor eAIP is inspected.
# Avinor's AIM portal lists the AIRAC editions; each edition links to
# .../View/Index/<n>/<YYYY-MM-DD>-AIRAC/html/index-en-GB.html (verified via
# the live-crawl test + public edition URLs). The landing page is scanned
# for the latest effective AIRAC edition.
ROOT_URL = "https://aim-prod.avinor.no/no/AIP/"

# Same edition-resolution helpers as the NL crawler, in case IPPC exposes a
# default/index page listing dated AIRAC editions instead of linking straight
# to a frameset.
_EDITION_DATE_RE = re.compile(r"(\d{4})_(\d{2})_(\d{2})[\\/]index[^\\/]*\.html", re.I)
# Avinor-style dated edition path: .../2026-01-22-AIRAC/...
_AIRAC_DATE_RE = re.compile(r"(\d{4})-(\d{2})-(\d{2})-AIRAC", re.I)
_EDITION_HREF_RE = re.compile(r"index(?:[-_][A-Za-z]{2}-[A-Za-z]{2})?\.html$", re.I)
_META_REFRESH_URL_RE = re.compile(r"url=([^;]+)", re.I)
_JS_LOCATION_RE = re.compile(r"""location(?:\.href)?\s*=\s*['"]([^'"]+)['"]""", re.I)


class NO(HttpEurocontrolBase):
    """Norway AIP crawler — Avinor eAIP (IPPC, https://www.ippc.no/).

    ⚠️ BEST-EFFORT / UNVERIFIED ⚠️
    There is NO task spec for Norway. Both the entry-point URL (``ROOT_URL``)
    and the AD-section id suffixes passed to ``extract_airports_from_html``
    below are *assumptions* modelled on the other EUROCONTROL-style eAIPs
    (NL/UK/FR) and have NOT been validated against the live Avinor eAIP.

    Before enabling this crawler in production you MUST:
      1. Open the live Avinor / IPPC eAIP and confirm the real HTML entry
         point (``ROOT_URL`` may need to be a ``default.html`` that lists dated
         AIRAC editions, or a differently-named index).
      2. Confirm the frame chain names — this assumes the standard
         ``["eAISNavigationBase", "eAISNavigation"]`` frameset.
      3. Confirm the AD-section id suffixes in the navigation HTML. This
         assumes the standard ``"AD 2en-GBdetails"`` (aerodromes → vfr) and
         ``"AD 3en-GBdetails"`` (heliports → heliport). Norway's eAIP may use a
         different language suffix (e.g. ``no-NO``) or different anchors.
      4. Verify AD-2 vs AD-3 really map to vfr vs heliport for this source.

    Assumed structure (mirrors nl.py):

        ROOT_URL (index / default.html)
            └─ [optional] pick edition by effective date
                └─ <edition>/index.html
                    └─ frameset
                        └─ frame name=eAISNavigationBase
                            └─ frame name=eAISNavigation  ← the menu we parse

    Import-clean: no network work happens at import or in ``__init__``.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _resolve_edition_url(
        self,
        base_url: str,
        html: str,
        today: datetime.date | None = None,
    ) -> str:
        """Resolve the current edition entry point, if ROOT_URL is an index.

        BEST-EFFORT: if ``ROOT_URL`` already points at the frameset this is a
        no-op path via the fallbacks. Primary path picks the latest dated
        AIRAC edition on/before ``today``; fallbacks handle a single-edition
        layout (bare/locale-suffixed ``index*.html`` link), a ``<meta refresh>``
        redirect, then a ``location = "…"`` JS redirect.
        """
        today = today or datetime.date.today()
        soup = self.soup(html)

        dated: list[tuple[datetime.date, str]] = []
        for a in soup.find_all("a", href=True):
            m = _EDITION_DATE_RE.search(a["href"]) or _AIRAC_DATE_RE.search(
                a["href"]
            )
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

        # ROOT_URL is presumably already the frameset — use it as-is.
        return base_url

    def _extract_first(
        self,
        nav_html: str,
        nav_url: str,
        id_candidates: list[str],
        category: str,
    ) -> list[Airport]:
        """Extract a menu section, trying each candidate id in turn."""
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

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. Resolve the currently effective edition. Avinor redirects
            #    /no/AIP/ -> /no/AIP/View/Index/<n>/history-no-NO.html, and the
            #    edition links on that page are RELATIVE - so they must be
            #    resolved against the FINAL post-redirect URL, not ROOT_URL
            #    (verified in the live-crawl test round 2).
            index_resp = self.fetch_response(ROOT_URL)
            index_url = str(index_resp.url)
            index_html = index_resp.text
            last_url, last_html = index_url, index_html

            edition_url = self._resolve_edition_url(index_url, index_html)

            # Prefer the English edition when the link points at the
            #  Norwegian one - the eAIP publishes both side by side.
            en_edition_url = edition_url.replace("index-no-NO", "index-en-GB")

            # 2. Walk the frame chain to the navigation HTML (English
            #    edition first, Norwegian as fallback).
            try:
                nav_url, nav_html = self.follow_frame_chain(
                    en_edition_url, ["eAISNavigationBase", "eAISNavigation"]
                )
            except Exception:
                nav_url, nav_html = self.follow_frame_chain(
                    edition_url, ["eAISNavigationBase", "eAISNavigation"]
                )
            last_url, last_html = nav_url, nav_html

            # 3. Extract aerodromes (AD 2 → vfr) and heliports (AD 3 →
            #    heliport), trying the en-GB and no-NO menu id variants.
            airports.extend(
                self._extract_first(
                    nav_html,
                    nav_url,
                    ["AD 2en-GBdetails", "AD 2no-NOdetails", "AD-2details"],
                    "vfr",
                )
            )
            airports.extend(
                self._extract_first(
                    nav_html,
                    nav_url,
                    ["AD 3en-GBdetails", "AD 3no-NOdetails", "AD-3details"],
                    "heliport",
                )
            )
        except Exception as e:
            self.logger.error(f"NO crawl failed: {e}")
            if last_html is not None:
                self.log_candidate_links(last_html, last_url)
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
