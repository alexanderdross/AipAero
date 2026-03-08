import logging
import re
import time
from urllib.parse import urljoin
from bs4 import BeautifulSoup

from crawlers.crawler_base import Airport, CrawlerBase

logger = logging.getLogger(__name__)

COUNTRY = "DE"
ROOT_VFR_URL = "https://aip.dfs.de/BasicVFR/"
ROOT_IFR_URL = "https://aip.dfs.de/BasicIFR/"


class DE(CrawlerBase):
    def __init__(self):
        super().__init__(COUNTRY)

    def fetch_page_with_redirect(self, url: str) -> tuple[str, str]:
        """Fetch page content and return (content, final_url) after following redirects"""
        try:
            logger.info(f"Fetching: {url}")
            self.driver.get(url)
            time.sleep(1)  # Wait for any redirects and page to load

            final_url = self.driver.current_url
            if url != final_url:
                logger.info(f"Redirected from {url} to {final_url}")

            return self.driver.page_source, final_url
        except Exception as e:
            logger.error(f"Error fetching {url}: {e}")
            raise

    def fetch_page(self, url: str) -> str:
        """Fetch page content using Selenium"""
        try:
            logger.debug(f"Fetching: {url}")
            self.driver.get(url)
            time.sleep(2)  # Wait for page to load
            return self.driver.page_source
        except Exception as e:
            logger.error(f"Error fetching {url}: {e}")
            raise

    def cheerio_fetch(self, base_url: str, html: str, selector: str, attr: str) -> str:
        """Equivalent to cheerioFetch utility function"""
        soup = BeautifulSoup(html, "html.parser")

        # Handle :contains() selector
        if ":contains(" in selector:
            # Extract the text to search for
            parts = selector.split(":contains(")
            tag = parts[0]
            text_part = parts[1].rstrip(")")
            text_to_find = text_part.strip('"').strip("'")

            # Find element containing the text
            elements = soup.find_all(tag)
            element = None
            for el in elements:
                if text_to_find in el.get_text():
                    element = el
                    break
        else:
            element = soup.select_one(selector)

        if not element:
            raise Exception(f"Could not find element with selector: {selector}")

        href = element.get(attr)
        if not href:
            raise Exception(f"Could not find attribute {attr} in element")

        full_url = urljoin(base_url, href)
        return self.fetch_page(full_url)

    def find_links_by_class(self, html: str, class_name: str) -> list[str]:
        """Find all links with specific class"""
        soup = BeautifulSoup(html, "html.parser")
        links = soup.find_all("a", class_=class_name)
        return [link.get("href") for link in links if link.get("href")]

    def get_link(self, root_url: str, airports_list: list[Airport]):
        """Process a single root URL (VFR or IFR)"""
        try:
            # Start at the DFS main page and follow redirects
            response_text, final_url = self.fetch_page_with_redirect(root_url)

            # Update root_url to the final redirected URL
            root_url = final_url

            if "BasicIFR" in root_url:
                # IFR processing
                self._process_ifr(root_url, response_text, airports_list)
            else:
                # VFR processing
                self._process_vfr(root_url, response_text, airports_list)

        except Exception as e:
            logger.error(f"Error processing {root_url}: {e}")
            raise

    def _process_ifr(
        self, root_url: str, response_text: str, airports_list: list[Airport]
    ):
        """Process IFR airports"""
        try:
            # Navigate to AD Aerodromes
            response_text = self.cheerio_fetch(
                root_url, response_text, 'a:contains("AD Aerodromes")', "href"
            )

            # Get aerodromes and heliports
            aerodromes_html = self.cheerio_fetch(
                root_url, response_text, 'a:contains("AD 2 Aerodromes")', "href"
            )
            heliports_html = self.cheerio_fetch(
                root_url, response_text, 'a:contains("AD 3 Heliports")', "href"
            )

            aerodrome_links = list(
                set(self.find_links_by_class(aerodromes_html, "folder-link"))
            )
            heliport_links = list(
                set(self.find_links_by_class(heliports_html, "folder-link"))
            )

            logger.info(
                f"Found {len(aerodrome_links)} aerodrome links and {len(heliport_links)} heliport links for IFR"
            )

            # Process aerodrome links
            for i, link in enumerate(aerodrome_links):
                logger.debug(f"Processing IFR aerodrome {i + 1}/{len(aerodrome_links)}")
                self._process_ifr_link(root_url, link, "aerodomes", airports_list)

            # Process heliport links
            for i, link in enumerate(heliport_links):
                logger.debug(f"Processing IFR heliport {i + 1}/{len(heliport_links)}")
                self._process_ifr_link(root_url, link, "heliports", airports_list)

        except Exception as e:
            logger.error(f"Error in IFR processing: {e}")
            raise

    def _process_ifr_link(
        self, root_url: str, link: str, link_type: str, airports_list: list[Airport]
    ):
        """Process individual IFR link"""
        try:
            url = urljoin(root_url, link)
            response_text = self.fetch_page(url)

            soup = BeautifulSoup(response_text, "html.parser")

            # Extract city
            city_element = soup.select_one("div.headlineText.left > span")
            city = city_element.get_text(strip=True) if city_element else ""

            # Extract ICAO
            icao_element = soup.select_one("a.document-link > span.document-name")
            icao = ""
            if icao_element:
                icao_text = icao_element.get_text(strip=True)
                icao_match = re.search(r"([A-Z]{4})", icao_text)
                if icao_match:
                    icao = icao_match.group(1)

            if city or icao:  # Only add if we found some data
                airports_list.append(
                    Airport(
                        icao=icao if icao else None,
                        title=f"{city} {icao}".strip(),
                        url=url,
                        type="ifr" if link_type == "aerodomes" else "heliport",
                        country=COUNTRY,
                    )
                )

        except Exception as e:
            logger.error(f"Error processing IFR link {link}: {e}")

    def _process_vfr(
        self, root_url: str, response_text: str, airports_list: list[Airport]
    ):
        """Process VFR airports"""
        try:
            aerodromes_html = self.cheerio_fetch(
                root_url, response_text, 'a:contains("AD Aerodromes")', "href"
            )
            heliports_html = self.cheerio_fetch(
                root_url,
                response_text,
                'a:contains("HEL AD Helicopter Aerodromes")',
                "href",
            )

            # Remove the first 3 links for aerodromes (AD 0 Content, AD 1 General Remarks, AD 2 list of Aerodromes)
            aerodrome_links = self.find_links_by_class(aerodromes_html, "folder-link")[
                3:
            ]
            # Remove the first link for heliports (HEL AD 3 list of Helicopter Aerodromes)
            heliport_links = self.find_links_by_class(heliports_html, "folder-link")[1:]

            logger.info(
                f"Found {len(aerodrome_links)} aerodrome links and {len(heliport_links)} heliport links for VFR"
            )

            # Process aerodrome links
            for i, link in enumerate(aerodrome_links):
                logger.info(f"Processing VFR aerodrome {i + 1}/{len(aerodrome_links)}")
                self._process_vfr_link(root_url, link, "aerodomes", airports_list)

            # Process heliport links
            for i, link in enumerate(heliport_links):
                logger.info(f"Processing VFR heliport {i + 1}/{len(heliport_links)}")
                self._process_vfr_link(root_url, link, "heliports", airports_list)

        except Exception as e:
            logger.error(f"Error in VFR processing: {e}")
            raise

    def _process_vfr_link(
        self, root_url: str, link: str, link_type: str, airports_list: list[Airport]
    ):
        """Process individual VFR link (A, B, C, ... links)"""
        try:
            url = urljoin(root_url, link)
            response_text = self.fetch_page(url)

            soup = BeautifulSoup(response_text, "html.parser")
            folder_links = soup.find_all("a", class_="folder-link")

            logger.info(f"Found {len(folder_links)} airports in VFR link")

            for el in folder_links:
                href = el.get("href", "")
                title_element = el.find("span")
                title = title_element.get_text(strip=True) if title_element else ""

                # Extract ICAO from title
                icao_match = re.search(r"([A-Z]{4})$", title)
                icao = icao_match.group(1) if icao_match else ""

                if title:  # Only add if we found a title
                    airports_list.append(
                        Airport(
                            country=COUNTRY,
                            icao=icao if icao else None,
                            title=title,
                            url=urljoin(url, href),
                            type="vfr" if link_type == "aerodomes" else "heliport",
                        )
                    )

        except Exception as e:
            logger.error(f"Error processing VFR link {link}: {e}")

    def crawl(self) -> list[Airport]:
        """Main crawling function for German airports"""
        airports_list = []

        try:
            # Process VFR URLs
            logger.info("Starting VFR processing...")
            self.get_link(ROOT_VFR_URL, airports_list)
            logger.info(
                f"VFR processing complete. Found {len(airports_list)} airports so far."
            )

            # Process IFR URLs
            logger.info("Starting IFR processing...")
            ifr_start_count = len(airports_list)
            self.get_link(ROOT_IFR_URL, airports_list)
            logger.info(
                f"IFR processing complete. Found {len(airports_list) - ifr_start_count} additional airports."
            )

            if len(airports_list) == 0:
                error_msg = f"No {COUNTRY} airports found"
                logger.error(error_msg)
                raise Exception(error_msg)

            logger.info(f"Found {len(airports_list)} airports for {COUNTRY}")
            logger.info(f"E.g. EDNY: {[a for a in airports_list if a.icao == 'EDNY']}")
            return airports_list

        except Exception as e:
            logger.error(f"Error during crawling: {e}")
            raise
        finally:
            if self.driver:
                self.driver.quit()
