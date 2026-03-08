from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

from crawlers.crawler_base import Airport
from crawlers.eurocontrol_base import EurocontrolBase


class PacN(EurocontrolBase):
    def __init__(self):
        super().__init__("PAC-N")

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports = []

        try:
            """
            Visit "Plan du site SIA" main page which has the static URL
            @locate the "eAIP FRANCE" link there
            """
            self.driver.get("https://www.sia.aviation-civile.gouv.fr/plandesite")
            eaip_url_pre = self.wait.until(
                EC.element_to_be_clickable(
                    (
                        By.XPATH,
                        "//div[contains(@id, 'plandesite')][.//h2[text()='AIP']]//a[contains(text(), 'eAIP PAC-N')]",
                    )
                )
            ).get_attribute("href")

            """
            Visit the "Publication eAIP / eAIP Issues" overview page
            @locate the link to the currently effective eAIP
            """
            self.driver.get(eaip_url_pre)
            # First we need to switch to the correct "<object>" container
            object_url = self.wait.until(
                EC.presence_of_element_located((By.TAG_NAME, "object"))
            ).get_attribute("data")
            self.driver.get(object_url)
            # Then we finally can locate the link to the currently effective eAIP
            eaip_url = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//a[contains(@id, 'dateVig')]"))
            ).get_attribute("href")

            """
            Visit the real "Publication eAIP / eAIP Issues" page
            """
            self.driver.get(eaip_url)
            self.wait.until(EC.presence_of_element_located((By.TAG_NAME, "frameset")))

            # Switch to the correct frame
            self.switch_to_last_frame(["eAISNavigationBase", "eAISNavigation"])

            airports.extend(self.extract_airports("AD-2details", "aeroport"))
            airports.extend(self.extract_airports("AD-3details", "aeroport"))

        except Exception as e:
            self.logger.error(e)
            self.save_screenshot()
            self.save_page_source()
        finally:
            self.driver.quit()
        return airports
