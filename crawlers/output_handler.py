import logging
import requests
from settings import Settings
from crawlers.crawler_base import Airport


class OutputHandler:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.logger = logging.getLogger(__name__)

    def write_output(self, airports: list[Airport], country: str):
        """
        Write the output the destination in settings.
        """
        if not airports:
            self.logger.warning(f"No airports found for {country}. Skipping output.")
            return

        self.logger.info(
            f"Writing output for {country} to {self.settings.api_endpoint}"
        )
        objects = [
            {
                "icao": a.icao if a.icao else None,
                "title": a.title,
                "url": a.url,
                "type": a.airport_type,
                "country": country.upper(),
            }
            for a in airports
        ]

        response = requests.post(
            self.settings.api_endpoint,
            json=objects,
            headers={"Authorization": f"Bearer {self.settings.api_key}"},
        )
        try:
            response.raise_for_status()
            self.logger.info(f"Successfully wrote output for {country}.")
        except requests.RequestException as e:
            print(e)
            self.logger.error(f"Failed to write output for {country}: {e}")
