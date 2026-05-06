from typing import Literal, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from crawlers.http_base import Airport, HttpCrawlerBase

COUNTRY = "AT"
ROOT_URL = "https://eaip.austrocontrol.at"


class AT(HttpCrawlerBase):
    """Austria AIP crawler.

    Austrocontrol's eAIP is plain ISO-8859-1 encoded HTML — no frames,
    no JS. Navigate through three index pages (current version → Part
    III/AD → AD 2/AD 3) and parse a simple table of <td><a>ICAO</a></td>
    rows on each leaf.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def fetch_iso(self, url: str) -> str:
        return self.fetch(url, encoding="iso-8859-1")

    @staticmethod
    def find_link_by_text(soup: BeautifulSoup, text: str) -> Optional[str]:
        link = soup.find("a", string=lambda t: bool(t) and text in t)
        return link.get("href") if link else None

    def extract_airports(
        self, url: str, airport_type: Literal["vfr", "ifr", "heliport"]
    ) -> list[Airport]:
        text = self.fetch_iso(url)
        soup = self.soup(text)
        airports: list[Airport] = []

        for row in soup.find_all("tr"):
            cells = row.find_all("td")
            if len(cells) < 2:
                continue

            first_links = cells[0].find_all("a")
            if not first_links:
                continue

            icao = first_links[0].get_text(strip=True)
            city = cells[1].get_text(strip=True)
            href = first_links[-1].get("href")

            if not href or icao == "AD 3":
                # "AD 3" is a section header row, not an aerodrome.
                continue

            full_url = urljoin(url, href)
            airports.append(
                Airport(
                    country=COUNTRY,
                    icao=icao or None,
                    title=f"{city} {icao}",
                    url=full_url,
                    type=airport_type,
                )
            )
        return airports

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        last_url = ROOT_URL
        last_html: str | None = None
        try:
            # 1. Root → "aktuelle Ausgabe / current version".
            root_html = self.fetch_iso(ROOT_URL)
            last_url, last_html = ROOT_URL, root_html

            href = self.find_link_by_text(
                self.soup(root_html), "aktuelle Ausgabe / current version"
            )
            if not href:
                raise ValueError(
                    f"'aktuelle Ausgabe / current version' link not found in "
                    f"{ROOT_URL}"
                )
            main_aip_url = urljoin(ROOT_URL, href)

            # 2. Current version → "Part III - AD".
            main_html = self.fetch_iso(main_aip_url)
            last_url, last_html = main_aip_url, main_html

            href = self.find_link_by_text(self.soup(main_html), "Part III - AD")
            if not href:
                raise ValueError(
                    f"'Part III - AD' link not found in {main_aip_url}"
                )
            ad_url = urljoin(main_aip_url, href)

            # 3. AD index → AD 2 (aerodromes) and AD 3 (heliports).
            ad_html = self.fetch_iso(ad_url)
            last_url, last_html = ad_url, ad_html
            ad_soup = self.soup(ad_html)

            href_airports = self.find_link_by_text(ad_soup, "AD 2")
            href_heliports = self.find_link_by_text(ad_soup, "AD 3")
            if not href_airports or not href_heliports:
                raise ValueError(
                    f"'AD 2' or 'AD 3' link not found in {ad_url}"
                )

            airports = self.extract_airports(
                urljoin(ad_url, href_airports), "vfr"
            )
            airports.extend(
                self.extract_airports(
                    urljoin(ad_url, href_heliports), "heliport"
                )
            )

            if not airports:
                raise ValueError(f"No {COUNTRY} airports found")

            self.logger.info(f"Found {len(airports)} airports for {COUNTRY}")
            return airports
        except Exception as e:
            self.logger.error(f"AT crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()
