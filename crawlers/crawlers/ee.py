from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "EE"
# The bare host redirects to the currently effective edition folder
# (`https://eaip.eans.ee/<YYYY-MM-DD>/html/`), which carries plain links to
# `index-en-GB.html` / `index-et.html` (probe_eaip run 29256408808). We
# resolve the folder via the redirect, then enter the English frameset.
ROOT_URL = "https://eaip.eans.ee/"

# eurocontrol menu ids differ between AIPs (see uk.py) - try the spaced,
# locale-suffixed form first, then the hyphenated short form. The base's
# extract_airports_from_html prints the REAL candidate ids on a miss, so a
# failed live run tells us the correct id without guessing.
_AD2_SECTION_IDS = ["AD 2en-GBdetails", "AD-2details", "AD 2details"]
_AD3_SECTION_IDS = ["AD 3en-GBdetails", "AD-3details", "AD 3details"]


class EE(HttpEurocontrolBase):
    """Estonia AIP crawler (EANS eAIP, task spec: europe-expansion.md).

    Standard eurocontrol frameset eAIP: the host root redirects to the
    current AIRAC edition folder; `index-en-GB.html` inside it is the
    frameset entry, and the frame chain leads to the navigation menu with
    aggregate AD 2 / AD 3 sections. Aerodromes are emitted as "vfr"
    (same convention as NO/PL/SE), heliports fail-soft as "heliport".
    """

    # Chart-PDF extraction (recon run 29264498572, crawlers/recon/
    # pdf-recon-batch1.md): eurocontrol chart-type codes in the
    # filenames, e.g. AD_2_EEKA_VAC_en.pdf / ..._ADC_en.pdf. Anchor
    # texts are empty, so match on href; VAC preferred, LDG as the
    # small-field fallback.
    FETCH_PDF_URLS = True
    PDF_HREF_PRIORITY = (r"_VAC_en\.pdf$", r"_ADC_en\.pdf$", r"_LDG_en\.pdf$")

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def crawl(self) -> list[Airport]:
        """Resolve the current edition, walk the frameset to the nav menu,
        emit AD 2 aerodromes (VFR) plus any AD 3 heliports, then attach
        chart-PDF links. ``last_url``/``last_html`` retain the last fetch so
        a failure dumps the offending page for post-mortem debugging."""
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. Resolve the current edition folder via the host redirect: the
            # bare host 302s to the dated edition dir, and response.url is the
            # final (post-redirect) URL we join index-en-GB.html onto.
            response = self.fetch_response(ROOT_URL)
            edition_index = urljoin(str(response.url), "index-en-GB.html")
            self.logger.info(f"EE edition index: {edition_index}")

            # 2. Walk the frame chain to the navigation HTML.
            nav_url, nav_html = self.follow_frame_chain(
                edition_index, ["eAISNavigationBase", "eAISNavigation"]
            )
            last_url, last_html = nav_url, nav_html

            # 3. Aerodromes (AD 2); heliports (AD 3) fail-soft - the section
            # may not exist in the EE menu.
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
                self.logger.info("EE: no AD 3 heliport section - skipping")

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"EE crawl failed: {e}")
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
        """Extract a menu section, trying each candidate id format in turn.

        The section-id spelling differs between eurocontrol AIPs (spaced vs
        hyphenated, with/without locale suffix), so we try each candidate and
        return the first that parses. If every candidate misses we re-raise
        the LAST ValueError - the base's error text lists the real ids seen in
        the menu, which tells us the correct id for the next iteration.
        """
        last_error: Exception | None = None
        for menu_id in id_candidates:
            try:
                return self.extract_airports_from_html(
                    nav_html, nav_url, menu_id, category  # type: ignore[arg-type]
                )
            except ValueError as e:
                last_error = e
        # find_all can never leave last_error None (id_candidates is non-empty).
        assert last_error is not None
        raise last_error
