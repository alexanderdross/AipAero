import re
from typing import Literal

from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.common.by import By

from crawlers.crawler_base import Airport, CrawlerBase


class EurocontrolBase(CrawlerBase):
    def __init__(self, country: str):
        super().__init__(country)
        self.country = country

    def extract_airports(
        self,
        id_in_menu: str,
        category: Literal["vfr", "ifr", "heliport", "mil", "aeroport"],
    ) -> list[Airport]:
        self.logger.info(f"Extracting airport data from {self.driver.current_url}")
        airports = []
        # Ends with id_in_menu
        escaped = id_in_menu.replace(" ", "\\ ")
        menu_div = self.driver.find_element(By.CSS_SELECTOR, f"[id$='{escaped}']")
        # all divs directly under id_in_menu
        menu_items = menu_div.find_elements(By.CSS_SELECTOR, f"#{id_in_menu} > div")
        # Always two following divs are of one airport, the first contains the title, the second contains the details
        paired = list(zip(menu_items[::2], menu_items[1::2]))
        print(len(paired))

        for title_div, details_div in paired:
            try:
                # title is the text of the second <a> directly under title_div
                title = title_div.find_elements(By.TAG_NAME, "a")[-1]
                title = str(title.get_attribute("innerText")).strip()
                # Replace special characters
                title = title.replace("—", "")
                title = re.sub(r"\s+", " ", title).strip()
                # UK has bullshit like TAD_HP;TXT_NAME;2631 after title
                title = title.split("TAD_HP")[0]
                icao = title.split(" ")[0].upper()
                title = " ".join(title.split(" ")[1:])
                # charts url is the url of the <a> with the "title" attribute that contains "charts" in any capitalization
                try:
                    charts_url = details_div.find_element(
                        By.XPATH,
                        ".//div//a[contains(translate(@title, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'charts related')]",
                    ).get_attribute("href")
                except NoSuchElementException:
                    # Otherwise use last <a> in details_div
                    charts_url = details_div.find_elements(By.CSS_SELECTOR, "div > a")[
                        -1
                    ].get_attribute("href")
                if not charts_url:
                    charts_url = "https://www.sia.aviation-civile.gouv.fr"

                airports.append(
                    Airport(
                        country=self.country,
                        icao=icao,
                        title=f"{title} {icao}".strip(),
                        url=charts_url,
                        type=category,
                    )
                )
            except IndexError:
                pass

        if not airports:
            raise ValueError(f"No airports found in {self.driver.current_url}")
        return airports
