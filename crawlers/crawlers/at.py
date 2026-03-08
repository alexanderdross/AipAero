import logging
from typing import Optional, Literal
from urllib.parse import urljoin
from bs4 import BeautifulSoup
import requests

from crawlers.crawler_base import Airport, CrawlerBase

logger = logging.getLogger(__name__)

COUNTRY = "AT"
ROOT_URL = "https://eaip.austrocontrol.at"


class AT(CrawlerBase):
    def __init__(self):
        super().__init__(COUNTRY)

    def fetch_iso8859(self, url: str) -> str:
        """Fetch page content with ISO-8859-1 encoding"""
        try:
            response = requests.get(url, timeout=30)
            response.encoding = "iso-8859-1"
            return response.text
        except Exception as e:
            logger.error(f"Error fetching {url}: {e}")
            raise

    def extract_airports(
        self, url: str, airport_type: Literal["vfr", "ifr", "heliport"]
    ) -> list[Airport]:
        """Extract airports from the given URL"""
        text = self.fetch_iso8859(url)
        soup = BeautifulSoup(text, "html.parser")
        table_rows = soup.find_all("tr")
        airports = []

        for row in table_rows:
            cells = row.find_all("td")
            if len(cells) < 2:
                continue

            # Extract ICAO code from first cell's first link
            first_link = cells[0].find("a")
            if not first_link:
                continue

            icao = first_link.get_text(strip=True)
            city = cells[1].get_text(strip=True)

            # Get href from last link in first cell
            last_link = cells[0].find_all("a")[-1] if cells[0].find_all("a") else None
            if not last_link:
                continue

            href = last_link.get("href")
            if not href or icao == "AD 3":
                continue

            # Create full URL
            full_url = urljoin(url, href)

            # Determine if it's a PDF or another page
            if full_url.endswith(".pdf"):
                airports.append(
                    Airport(
                        icao=icao if icao else None,
                        title=f"{city} {icao}",
                        url=full_url,
                        type=airport_type,
                        country=COUNTRY,
                    )
                )
            else:
                # TODO: Follow link and differentiate between VFR and IFR
                airports.append(
                    Airport(
                        icao=icao if icao else None,
                        title=f"{city} {icao}",
                        url=full_url,
                        type=airport_type,
                        country=COUNTRY,
                    )
                )

        return airports

    def find_link_by_text(self, soup: BeautifulSoup, text: str) -> Optional[str]:
        """Find link by text content"""
        link = soup.find("a", string=lambda t: t and text in t)
        return link.get("href") if link else None

    def crawl(self) -> list[Airport]:
        """Main crawling function for Austrian airports"""
        try:
            # Start at the Austro Control main page
            response = self.fetch_iso8859(ROOT_URL)
            soup = BeautifulSoup(response, "html.parser")

            href = self.find_link_by_text(soup, "aktuelle Ausgabe / current version")
            if not href:
                error_msg = f'Could not find "aktuelle Ausgabe / current version" link in {ROOT_URL}'
                logger.error(error_msg)
                raise Exception(error_msg)

            # Go to the current release page
            main_aip_url = urljoin(ROOT_URL, href)
            response = self.fetch_iso8859(main_aip_url)
            soup = BeautifulSoup(response, "html.parser")

            href = self.find_link_by_text(soup, "Part III - AD")
            if not href:
                error_msg = f'Could not find "Part III - AD" link in {main_aip_url}'
                logger.error(error_msg)
                raise Exception(error_msg)

            # Go to the Part III - AD page
            ad_url = urljoin(main_aip_url, href)
            response = self.fetch_iso8859(ad_url)
            soup = BeautifulSoup(response, "html.parser")

            href_airports = self.find_link_by_text(soup, "AD 2")
            href_heliports = self.find_link_by_text(soup, "AD 3")

            if not href_airports or not href_heliports:
                error_msg = f'Could not find "AD 2" or "AD 3" link in {ad_url}'
                logger.error(error_msg)
                raise Exception(error_msg)

            # Go to the AD 2 and AD 3 pages
            airports_url = urljoin(ad_url, href_airports)
            heliports_url = urljoin(ad_url, href_heliports)

            airports_list = self.extract_airports(airports_url, "vfr")
            airports_list.extend(self.extract_airports(heliports_url, "heliport"))

            if len(airports_list) == 0:
                error_msg = f"No {COUNTRY} airports found"
                logger.error(error_msg)
                raise Exception(error_msg)

            logger.info(f"Found {len(airports_list)} airports for {COUNTRY}")
            return airports_list

        except Exception as e:
            logger.error(f"Error during crawling: {e}")
            raise
        finally:
            if self.driver:
                self.driver.quit()
