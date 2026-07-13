import re

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "PT"
# NAV Portugal serves the eAIP behind an amendment-stable alias
# (probe_eaip run 29255990091) - no edition picker needed. A separate
# eVFR publication exists under eVFR_Current/ (candidate for a later
# type split like DE BasicVFR/BasicIFR).
ROOT_URL = (
    "https://ais.nav.pt/wp-content/uploads/AIS_Files/"
    "eAIP_Current/eAIP_Online/eAIP/html/index.html"
)

# The PT menu has NO aggregate "AD 2" section: every aerodrome is its own
# top-level chapter with an id like "AD-2.LPPTdetails" (live run
# 29259975942 listed 19 such ids). Same layout as CZ.
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
        last_error: Exception | None = None
        for chain in _FRAME_CHAINS:
            try:
                return self.follow_frame_chain(ROOT_URL, chain)
            except Exception as e:
                last_error = e
        assert last_error is not None
        raise last_error

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            nav_url, nav_html = self._enter_nav()
            last_url, last_html = nav_url, nav_html

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
