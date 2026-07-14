import re

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "PT"
# NAV Portugal serves the eAIP behind an amendment-stable alias
# (probe_eaip run 29255990091) - no edition picker needed.
ROOT_URL = (
    "https://ais.nav.pt/wp-content/uploads/AIS_Files/"
    "eAIP_Current/eAIP_Online/eAIP/html/index.html"
)

# The separate eVFR Manual (small VFR aerodromes/heliports the main eAIP omits)
# is a eurocontrol frameset under the amendment-stable eVFR_Current alias. Its
# menu is Portuguese-ONLY (the -en-PT variant 404s, dump run 29339283332) and
# lives at a fixed path, so we fetch it directly rather than walking frames.
# Names are place names, so the Portuguese menu is fine.
EVFR_MENU_URL = (
    "https://ais.nav.pt/wp-content/uploads/AIS_Files/"
    "eVFR_Current/eVFR_Online/eAIP/html/eAIP/LP-menu-pt-PT.html"
)

# The PT menu has NO aggregate "AD 2" section: every aerodrome is its own
# top-level chapter with an id like "AD-2.LPPTdetails" (live run
# 29259975942 listed 19 such ids). Same layout as CZ. The eVFR manual uses
# the same eurocontrol chapter ids.
_AD2_CHAPTER_RE = re.compile(r"AD-2\.([A-Z]{4})details$")
_AD3_CHAPTER_RE = re.compile(r"AD-3\.([A-Z]{4})details$")

_FRAME_CHAINS = (
    ["eAISNavigationBase", "eAISNavigation"],
    ["eAISNavigation"],
)


class PT(HttpEurocontrolBase):
    """Portugal AIP crawler (NAV Portugal eAIP, task spec:
    europe-expansion.md).

    Standard eurocontrol frameset behind the stable eAIP_Current alias,
    but with per-aerodrome chapters instead of an aggregate AD-2 menu
    section (like CZ). Aerodromes are "vfr" (NO/PL/SE convention),
    heliport chapters fail-soft.
    """

    # Chart-PDF extraction (recon run 29264498572, crawlers/recon/
    # pdf-recon-batch1.md): positional AD 2.24 numbering, e.g.
    # LP_AD_2_LPBJ_01-1_en.pdf - 01 is the aerodrome chart on every
    # sampled field. Add a VAC-number pattern IN FRONT once the VAC's
    # chart number (12 or 13?) is verified by opening one PDF.
    FETCH_PDF_URLS = True
    PDF_HREF_PRIORITY = (r"_01-1_en\.pdf$",)

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _enter_nav(self) -> tuple[str, str]:
        """Walk the frameset to the navigation HTML, tolerating either frame
        layout. NAV Portugal has shipped the menu both nested (a base frame
        wrapping the nav frame) and flat (nav frame directly), so we try each
        frame chain in turn and return the first that resolves; if all fail we
        re-raise the last error."""
        last_error: Exception | None = None
        for chain in _FRAME_CHAINS:
            try:
                return self.follow_frame_chain(ROOT_URL, chain)
            except Exception as e:
                last_error = e
        assert last_error is not None
        raise last_error

    def _crawl_evfr(self) -> list[Airport]:
        """Harvest the eVFR Manual (small VFR aerodromes/heliports the main
        eAIP omits). The menu is a plain eurocontrol nav HTML at a fixed path,
        so it is fetched directly (no frame walk). Same per-chapter layout as
        the eAIP. Fully fail-soft: any failure logs and returns what was
        gathered, so a VFR-manual hiccup never aborts the PT eAIP crawl."""
        airports: list[Airport] = []
        try:
            menu_html = self.fetch(EVFR_MENU_URL)
        except Exception as e:
            self.logger.warning(f"PT eVFR: menu fetch failed: {e}")
            return airports
        try:
            airports.extend(
                self.extract_airports_per_chapter(
                    menu_html, EVFR_MENU_URL, _AD2_CHAPTER_RE, "vfr"
                )
            )
        except ValueError as e:
            self.logger.warning(f"PT eVFR: no AD-2 chapters ({e})")
        try:
            airports.extend(
                self.extract_airports_per_chapter(
                    menu_html, EVFR_MENU_URL, _AD3_CHAPTER_RE, "heliport"
                )
            )
        except ValueError:
            self.logger.info("PT eVFR: no AD-3 heliport chapters - skipping")
        self.logger.info(f"PT eVFR: extracted {len(airports)} VFR fields")
        return airports

    def crawl(self) -> list[Airport]:
        """Enter the frameset, emit every per-aerodrome AD-2 chapter as VFR
        plus any AD-3 heliport chapters, merge in the eVFR-manual fields not
        already listed, then attach chart-PDF links. ``last_url``/``last_html``
        retain the last fetch so a failure can dump the offending page for
        post-mortem debugging."""
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            nav_url, nav_html = self._enter_nav()
            last_url, last_html = nav_url, nav_html

            # Like CZ, aerodromes are per-chapter (no aggregate AD 2 section):
            # the base's per-chapter helper matches each "AD-2.<ICAO>details".
            airports.extend(
                self.extract_airports_per_chapter(
                    nav_html, nav_url, _AD2_CHAPTER_RE, "vfr"
                )
            )
            try:
                airports.extend(
                    self.extract_airports_per_chapter(
                        nav_html, nav_url, _AD3_CHAPTER_RE, "heliport"
                    )
                )
            except ValueError:
                self.logger.info("PT: no AD 3 heliport chapters - skipping")

            # Merge the eVFR-manual fields (type "vfr"/heliport) that are NOT
            # already in the eAIP - one crawler owns country PT (the API
            # delete+inserts per country), so both publications are returned
            # together. Dedupe by ICAO, keeping the eAIP row for shared fields.
            # Wrapped so a eVFR-manual failure can NEVER drop the eAIP fields
            # (the whole VFR merge is a bonus on top of the guaranteed eAIP set).
            try:
                have = {a.icao for a in airports if a.icao}
                evfr_added = 0
                for a in self._crawl_evfr():
                    if a.icao and a.icao in have:
                        continue
                    airports.append(a)
                    if a.icao:
                        have.add(a.icao)
                    evfr_added += 1
                self.logger.info(f"PT: merged {evfr_added} eVFR-only fields")
            except Exception as e:
                self.logger.warning(f"PT eVFR merge failed (keeping eAIP): {e}")

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"PT crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
