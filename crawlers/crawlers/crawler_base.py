import datetime
import html
import logging
import re
import shutil
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field
from selenium import webdriver
from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager
from webdriver_manager.core.os_manager import ChromeType


class Airport(BaseModel):
    country: str
    icao: str | None
    title: str
    url: str
    airport_type: Literal["vfr", "ifr", "heliport", "mil", "aeroport"] = Field(
        alias="type"
    )


class CrawlerBase:
    def __init__(self, country: str):
        self.country = country.upper()
        self.logger = logging.getLogger(__name__)
        self.driver = self.setup_driver()
        self.wait = WebDriverWait(self.driver, 5)

    def setup_driver(self) -> webdriver.Chrome:
        """WebDriver im Headless-Modus einrichten"""
        try:
            # Chrome-Optionen konfigurieren
            chrome_options = Options()
            chrome_options.add_argument("--headless")  # Headless-Modus
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--window-size=1920,1080")
            chrome_options.add_argument(
                "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            )

            # WebDriver initialisieren
            chrome_type = (
                ChromeType.CHROMIUM if shutil.which("chromium") else ChromeType.GOOGLE
            )
            driver = webdriver.Chrome(
                service=Service(ChromeDriverManager(chrome_type=chrome_type).install()),
                options=chrome_options,
            )
            return driver
        except WebDriverException as e:
            self.logger.error(f"Fehler beim Einrichten des WebDrivers: {e}")
            raise

    def _get_timestamp(self) -> str:
        """Erzeugt einen Zeitstempel für Dateinamen"""
        return datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

    def save_screenshot(self, prefix="screenshot") -> None:
        """Speichert einen Screenshot mit Zeitstempel im Dateinamen"""
        try:
            timestamp = self._get_timestamp()
            filename = f"error_logs/{timestamp}_{self.country}_{prefix}.png"
            Path("error_logs").mkdir(parents=True, exist_ok=True)
            self.driver.save_screenshot(filename)
            self.logger.info(f"Screenshot gespeichert als '{filename}'")
        except Exception as e:
            self.logger.error(f"Fehler beim Speichern des Screenshots: {e}")

    def save_page_source(self, prefix="page_source") -> None:
        """Speichert den Seitenquelltext mit Zeitstempel im Dateinamen"""
        try:
            timestamp = self._get_timestamp()
            filename = f"error_logs/{timestamp}_{self.country}_{prefix}.html"
            Path("error_logs").mkdir(parents=True, exist_ok=True)
            with open(filename, "w", encoding="utf-8") as f:
                f.write(self.driver.page_source)
            self.logger.info(f"Seitenquelltext gespeichert als '{filename}'")
        except Exception as e:
            self.logger.error(f"Fehler beim Speichern des Seitenquelltexts: {e}")

    def switch_to_last_frame(self, frames: list[str]) -> None:
        """
        Switches to the last / inner frame in the list.
        """
        for frame in frames:
            try:
                self.wait.until(
                    EC.frame_to_be_available_and_switch_to_it((By.NAME, frame))
                )
            except Exception as e:
                self.logger.error(f"Error switching to frame '{frame}': {e}")
                self.save_screenshot("frame_switch_error")
                self.save_page_source("frame_switch_error")
                raise

    def clean_text(self, text):
        """Entfernt HTML-Entities und überschüssige Leerzeichen"""
        if not text:
            return ""
        # HTML-Entities dekodieren
        text = html.unescape(text)
        # Mehrfache Leerzeichen durch ein einzelnes ersetzen
        text = re.sub(r"\s+", " ", text)
        # Führende und nachfolgende Leerzeichen entfernen
        return text.strip()

    def crawl(self) -> list[Airport]:
        raise NotImplementedError("Crawlers should implement this method.")
