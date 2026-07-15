"""Slovakia (LPS SR) eAIP crawler.

Source: the Slovak AIS portal (aim.lps.sk) is a session-based PHP site, but its
"AIP SR" page publicly links the currently effective eAIP - a standard
eurocontrol frameset - with no login:

    https://aim.lps.sk/web/index.php?fn=200&lng=en
        ├─ [Currently Effective] .../eAIP_SR/AIP_SR_EFF_<ddMMMyyyy>[_amdt]/html/LZ-frameset-en-SK.html
        └─ [Next Issue]          .../eAIP_SR/AIP_SR_EFF_<ddMMMyyyy>/html/LZ-frameset-en-SK.html

The bare `aim.lps.sk/` root 403s and the separate VFR Manual is an ArcGIS map
app, but the eAIP frameset itself is open. This crawler reads the AIP SR page,
follows the "Currently Effective" link (by its anchor text - the ddMMMyyyy URL
date and the optional `_amdt` suffix make date parsing fragile), walks the
frame chain to the navigation menu, and reads AD 2 (aerodromes) / AD 3
(heliports). Pure HTML - no JS/browser, no login. Browser headers are sent
because the LPS WAF rejects a plain UA on some paths.
"""

import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "SK"
# The public "AIP SR" page that links the currently effective eAIP frameset.
AIP_INDEX_URL = "https://aim.lps.sk/web/index.php?fn=200&lng=en"

# The eAIP edition links are `.../eAIP_SR/AIP_SR_EFF_<...>/html/LZ-frameset-en-SK.html`.
_FRAMESET_HREF_RE = re.compile(r"eAIP_SR/.*LZ-frameset-en-SK\.html", re.I)

# eurocontrol menu ids vary by generator: spaced locale-suffixed ("AD 2en-GBdetails")
# vs hyphenated short form ("AD-2details"). Try both so a menu-format tweak
# doesn't silently empty the list. The SK eAIP is English (-en-SK frameset), so
# an -en-GB suffix is the likely IDS form.
_AD2_SECTION_IDS = ["AD 2en-GBdetails", "AD 2en-SKdetails", "AD-2details"]
_AD3_SECTION_IDS = ["AD 3en-GBdetails", "AD 3en-SKdetails", "AD-3details"]


class SK(HttpEurocontrolBase):
    """Slovakia (LPS SR) AIP crawler.

    Resolves the currently effective eAIP frameset from the public AIP SR page,
    then walks the eurocontrol frame chain to the navigation HTML - no JS,
    no login.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)
        # The LPS WAF 403s a plain UA on some paths - present as a browser.
        self.use_browser_headers()

    def _resolve_effective_frameset(self, base_url: str, html: str) -> str:
        """Return the 'Currently Effective' eAIP frameset URL from the AIP SR page.

        There are two frameset links (Currently Effective + Next Issue); pick the
        one whose visible anchor text says "currently effective". Falls back to
        the first frameset link if the label is absent (fail-soft).
        """
        soup = self.soup(html)
        first_frameset: str | None = None
        for a in soup.find_all("a", href=True):
            if not _FRAMESET_HREF_RE.search(a["href"]):
                continue
            url = urljoin(base_url, a["href"])
            if first_frameset is None:
                first_frameset = url
            text = " ".join(a.get_text(" ", strip=True).split()).lower()
            if "currently effective" in text or "effective" in text:
                self.logger.info(f"SK currently effective eAIP: {url}")
                return url
        if first_frameset is not None:
            self.logger.info(
                f"SK eAIP (no 'effective' label matched; first frameset): "
                f"{first_frameset}"
            )
            return first_frameset
        raise ValueError(f"No eAIP frameset link found on {base_url}")

    # Chart-PDF extraction (recon 2026-07-15): each aerodrome's AD 2.24 page
    # lists LZ_AD_2_<ICAO>_<sec>-<n>_en.pdf with link text "AD 2-<ICAO>-2-1"
    # etc. Sheet 2-1 is the aerodrome chart (ICAO); prefer it over the
    # "Printable version" full-AD-2 text PDF that sits first in document order.
    FETCH_PDF_URLS = True
    PDF_TEXT_PRIORITY = (r"^AD 2-\w{4}-2-1$",)

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

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = AIP_INDEX_URL
        last_html: str | None = None

        try:
            # 1. AIP SR page -> currently effective eAIP frameset.
            index_html = self.fetch(AIP_INDEX_URL)
            last_url, last_html = AIP_INDEX_URL, index_html
            frameset_url = self._resolve_effective_frameset(
                AIP_INDEX_URL, index_html
            )

            # 2. Walk the frame chain to the navigation HTML. The SK frameset is
            # FLAT and names its frames eAIPNavigation / eAIPContent (note "eAIP",
            # not the usual "eAIS"), so the menu is one hop away.
            nav_url, nav_html = self.follow_frame_chain(
                frameset_url, ["eAIPNavigation"]
            )
            last_url, last_html = nav_url, nav_html

            # 3. Aerodromes (AD 2) and heliports (AD 3, fail-soft if absent).
            airports.extend(
                self._extract_section(nav_html, nav_url, _AD2_SECTION_IDS, "vfr")
            )
            try:
                airports.extend(
                    self._extract_section(
                        nav_html, nav_url, _AD3_SECTION_IDS, "heliport"
                    )
                )
            except ValueError as e:
                self.logger.info(f"SK: no AD 3 heliport section ({e})")

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"SK crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
