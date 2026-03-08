from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

from crawlers.crawler_base import Airport
from crawlers.eurocontrol_base import EurocontrolBase


class BelgiumLux(EurocontrolBase):
    def __init__(self):
        super().__init__("FR")

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports = []

        try:
            self.driver.get(
                "https://ops.skeyes.be/html/belgocontrol_static/eaip/eAIP_Main/html/index-en-GB.html"
            )
            self.wait.until(EC.presence_of_element_located((By.TAG_NAME, "frameset")))

            # Switch to the correct frame
            self.switch_to_last_frame(["eAISNavigation"])

            airports.extend(self.extract_airports("14details", "aeroport"))
            airports.extend(self.extract_airports("00details", "aeroport"))
            airports.extend(self.extract_airports("01details", "aeroport"))
            airports.extend(self.extract_airports("02details", "aeroport"))
            airports.extend(self.extract_airports("03details", "aeroport"))
            airports.extend(self.extract_airports("04details", "aeroport"))

        except Exception as e:
            self.logger.error(e)
            self.save_screenshot()
            self.save_page_source()
        finally:
            self.driver.quit()
        return airports
