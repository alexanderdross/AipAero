from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "UK"
ROOT_URL = "https://nats-uk.ead-it.com/cms-nats/opencms/en/Publications/AIP/"


class UK(HttpEurocontrolBase):
    """United Kingdom AIP crawler.

    NATS UK serves the same eurocontrol-style frameset eAIP as the other
    European AIPs, gated by a "Current AIP" panel on the publications
    landing page that links to the current edition's `Online Version`.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. Landing page → "Current AIP" container → "Online Version" link.
            landing_html = self.fetch(ROOT_URL)
            last_url, last_html = ROOT_URL, landing_html

            soup = self.soup(landing_html)
            container = None
            for div in soup.find_all("div", class_="container_white"):
                h3 = div.find("h3")
                if h3 and h3.get_text(strip=True) == "Current AIP":
                    container = div
                    break
            if container is None:
                raise ValueError(
                    f"'Current AIP' container not found in {ROOT_URL}"
                )

            online_version_link = None
            for a in container.find_all("a", href=True):
                if "Online Version" in a.get_text():
                    online_version_link = a
                    break
            if online_version_link is None:
                raise ValueError(
                    f"'Online Version' link not found in Current AIP container "
                    f"on {ROOT_URL}"
                )

            edition_url = urljoin(ROOT_URL, online_version_link["href"])
            self.logger.info(f"Current edition: {edition_url}")

            # 2. Walk the frame chain to the navigation HTML.
            nav_url, nav_html = self.follow_frame_chain(
                edition_url, ["eAISNavigationBase", "eAISNavigation"]
            )
            last_url, last_html = nav_url, nav_html

            # 3. Aerodromes (AD 2) and heliports (AD 3).
            airports.extend(
                self.extract_airports_from_html(
                    nav_html, nav_url, "AD-2details", "vfr"
                )
            )
            airports.extend(
                self.extract_airports_from_html(
                    nav_html, nav_url, "AD-3details", "heliport"
                )
            )
        except Exception as e:
            self.logger.error(f"UK crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
