from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "FI"
# Fintraffic ANS publishes the eAIP under an amendment-stable alias - no
# edition picker needed (probe_eaip run 29256408808 saw section files under
# `/eaip/currently_effective/eAIP/EF-GEN 2.2-fi-FI.html`; filenames carry
# spaces like LVNL's). Candidate frameset entry points inside that folder,
# tried in order.
BASE_URL = "https://www.ais.fi/eaip/currently_effective/"
_INDEX_CANDIDATES = ["index-en-GB.html", "index.html", "index-fi-FI.html"]

_AD2_SECTION_IDS = ["AD 2en-GBdetails", "AD-2details", "AD 2details"]
_AD3_SECTION_IDS = ["AD 3en-GBdetails", "AD-3details", "AD 3details"]


class FI(HttpEurocontrolBase):
    """Finland AIP crawler (Fintraffic ANS eAIP, task spec:
    europe-expansion.md).

    Standard eurocontrol frameset eAIP behind the amendment-stable
    `currently_effective` alias. Aerodromes are emitted as "vfr" (same
    convention as NO/PL/SE), heliports fail-soft as "heliport".
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _resolve_index(self) -> str:
        last_error: Exception | None = None
        for candidate in _INDEX_CANDIDATES:
            url = urljoin(BASE_URL, candidate)
            try:
                self.fetch(url)
                return url
            except Exception as e:  # 404 etc. - try the next candidate
                last_error = e
        raise ValueError(
            f"No eAIP index found under {BASE_URL} "
            f"(tried {_INDEX_CANDIDATES}): {last_error}"
        )

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = BASE_URL
        last_html: str | None = None

        try:
            index_url = self._resolve_index()
            self.logger.info(f"FI edition index: {index_url}")

            nav_url, nav_html = self.follow_frame_chain(
                index_url, ["eAISNavigationBase", "eAISNavigation"]
            )
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
                self.logger.info("FI: no AD 3 heliport section - skipping")

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"FI crawl failed: {e}")
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
