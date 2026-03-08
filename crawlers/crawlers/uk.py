from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

from crawlers.crawler_base import Airport
from crawlers.eurocontrol_base import EurocontrolBase


class UK(EurocontrolBase):
    def __init__(self):
        super().__init__("UK")

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports = []

        try:
            # Visit main page
            self.driver.get(
                "https://nats-uk.ead-it.com/cms-nats/opencms/en/Publications/AIP/"
            )
            self.wait.until(
                EC.presence_of_element_located(
                    (
                        By.XPATH,
                        "//div[contains(@class, 'container_white')][.//h3[text()='Current AIP']]",
                    )
                )
            )

            # Get current AIP URL
            eaip_url = self.wait.until(
                EC.element_to_be_clickable(
                    (
                        By.XPATH,
                        "//div[contains(@class, 'container_white')][.//h3[text()='Current AIP']]//a[contains(text(), 'Online Version')]",
                    )
                )
            ).get_attribute("href")

            if not eaip_url:
                self.logger.error("No URL in eAIP button found")
                self.save_screenshot("error_no_url")
                raise ValueError("No URL in eAIP button found")

            # Visit EAIP page
            self.driver.get(eaip_url)
            self.wait.until(EC.presence_of_element_located((By.TAG_NAME, "frameset")))

            # Switch to the correct frame
            self.switch_to_last_frame(["eAISNavigationBase", "eAISNavigation"])

            airports.extend(self.extract_airports("AD-2details", "vfr"))
            airports.extend(self.extract_airports("AD-3details", "heliport"))

        except Exception as e:
            self.logger.error(e)
            self.save_screenshot()
            self.save_page_source()
        finally:
            self.driver.quit()
        return airports
