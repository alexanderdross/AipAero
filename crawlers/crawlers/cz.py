from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "CZ"
ROOT_URL = "https://aim.rlp.cz/eaip/html/index-en-GB.html"

# eurocontrol menu ids differ between AIPs: IDS-generated eAIPs use spaced,
# locale-suffixed ids ("AD 2en-GBdetails"); others use the hyphenated short
# form ("AD-2details"). Try both so a menu-format tweak on the source's side
# doesn't silently empty the list.
_AD2_SECTION_IDS = ["AD 2en-GBdetails", "AD-2details"]


class CZ(HttpEurocontrolBase):
    """Czechia (Česko) AIP crawler.

    ANS CR / RLP serves the standard eurocontrol frameset eAIP at
    `aim.rlp.cz`. ``index-en-GB.html`` is the frameset entry point itself
    (no separate edition-picker landing page), so we walk the frame chain
    straight to the navigation HTML and read the AD 2 aerodrome section.

    Per the CZ task spec (crawlers/tasks/crawler_czech.md) every airport
    listed under the AD section is emitted as type "ifr", and the per-airport
    URL is the "Charts related to the aerodrome" link (handled by
    ``extract_airports_from_html``). No JS/browser needed.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

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
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. Walk the frame chain from the frameset index to the nav HTML.
            nav_url, nav_html = self.follow_frame_chain(
                ROOT_URL, ["eAISNavigationBase", "eAISNavigation"]
            )
            last_url, last_html = nav_url, nav_html

            # 2. All AD-section aerodromes are type "ifr" per the CZ spec.
            airports.extend(
                self._extract_section(nav_html, nav_url, _AD2_SECTION_IDS, "ifr")
            )
        except Exception as e:
            self.logger.error(f"CZ crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
