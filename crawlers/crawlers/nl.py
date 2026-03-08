import logging
import time
from typing import Literal, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

from crawlers.crawler_base import Airport
from crawlers.eurocontrol_base import EurocontrolBase

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

COUNTRY = "NL"
ROOT_URL = "https://eaip.lvnl.nl/web/eaip/default.html"


class NL(EurocontrolBase):
    def __init__(self):
        super().__init__(COUNTRY)

    def crawl(self) -> list[Airport]:
        """Main crawling function for Dutch airports"""
        self.logger.info(f"Crawling airports in {self.country}")
        airports = []

        try:
            # Start at the LVNL main page
            self.driver.get(ROOT_URL)

            eaip_url = self.wait.until(
                EC.element_to_be_clickable(
                    (By.XPATH, "//a[contains(@href, 'index.html')]")
                )
            ).get_attribute("href")
            self.logger.info(eaip_url)
            self.driver.get(eaip_url)
            self.wait.until(EC.presence_of_element_located((By.TAG_NAME, "frameset")))

            # Switch to the correct frame
            self.switch_to_last_frame(["eAISNavigationBase", "eAISNavigation"])

            airports.extend(self.extract_airports("AD 2en-GBdetails", "vfr"))
            airports.extend(self.extract_airports("AD 3en-GBdetails", "heliport"))

        except Exception as e:
            self.logger.error(e)
            self.save_screenshot()
            self.save_page_source()
        finally:
            self.driver.quit()
        self.logger.info(f"Found {len(airports)} airports for NL.")
        return airports
