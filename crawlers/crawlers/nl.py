from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "NL"
ROOT_URL = "https://eaip.lvnl.nl/web/eaip/default.html"


class NL(HttpEurocontrolBase):
    """Netherlands AIP crawler.

    LVNL's eAIP is a static eurocontrol-style frameset:

        default.html
            └─ <a href="…/index.html">  (current effective edition)
                └─ frameset
                    └─ frame name=eAISNavigationBase
                        └─ frame name=eAISNavigation  ← the menu we parse

    No JS execution is needed — every step resolves to a plain HTML doc.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. Resolve the link to the current effective edition.
            default_html = self.fetch(ROOT_URL)
            last_url, last_html = ROOT_URL, default_html

            soup = self.soup(default_html)
            edition_link = soup.find(
                "a", href=lambda h: bool(h) and "index.html" in h
            )
            if edition_link is None:
                raise ValueError(
                    f"Could not find current-edition link in {ROOT_URL}"
                )
            edition_url = urljoin(ROOT_URL, edition_link["href"])
            self.logger.info(f"Current edition: {edition_url}")

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
        except Exception as e:
            self.logger.error(f"NL crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
