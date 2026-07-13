import logging
import sys
from time import perf_counter

from pydantic import ValidationError

from crawlers.at import AT
from crawlers.be import BE
from crawlers.cz import CZ
from crawlers.de import DE
from crawlers.ee import EE
from crawlers.es import ES
from crawlers.fi import FI
from crawlers.lv import LV
from crawlers.dk import DK
from crawlers.fr import FR
from crawlers.gr import GR
from crawlers.nl import NL
from crawlers.no import NO
from crawlers.pl import PL
from crawlers.se import SE
from crawlers.uk import UK
from output_handler import OutputHandler
from settings import Settings

logger = logging.getLogger()

# The active, scheduled crawlers, keyed by country code. `main.py` runs the
# whole set by default; pass country codes as CLI args to run a subset
# (e.g. `uv run main.py NL UK` to re-crawl only the Netherlands and the UK).
COUNTRY_CRAWLERS = {
    "AT": AT,
    "DE": DE,
    "EE": EE,
    "ES": ES,
    "FI": FI,
    "LV": LV,
    "FR": FR,
    "NL": NL,
    "UK": UK,
    "BE": BE,
    "CZ": CZ,
    "DK": DK,
    "GR": GR,
    "NO": NO,
    "PL": PL,
    "SE": SE,
}


def select_crawlers(countries: list[str] | None = None) -> list:
    """Instantiate the requested country crawlers (all of them if none given).

    Country codes are case-insensitive. An unknown code aborts the run rather
    than silently crawling a subset the caller didn't intend.
    """
    if not countries:
        return [cls() for cls in COUNTRY_CRAWLERS.values()]

    selected = []
    unknown = []
    for code in countries:
        cls = COUNTRY_CRAWLERS.get(code.upper())
        if cls is None:
            unknown.append(code)
        else:
            selected.append(cls)
    if unknown:
        available = ", ".join(COUNTRY_CRAWLERS)
        raise SystemExit(
            f"Unknown country code(s): {', '.join(unknown)}. Available: {available}"
        )
    return [cls() for cls in selected]


def main(countries: list[str] | None = None):
    logger.info("Starting crawling process")
    crawlers = select_crawlers(countries)
    logger.info(
        f"Crawling {len(crawlers)} country/countries: "
        f"{', '.join(c.country for c in crawlers)}"
    )
    output_handler = OutputHandler(settings)
    for crawler in crawlers:
        logger.info(f"Starting crawler: {crawler.country}")
        try:
            start = perf_counter()
            airports = crawler.crawl()
            country = crawler.country
            end = perf_counter()
            logger.info(f"Finished crawling {country} in {end - start:.2f} seconds")
            output_handler.write_output(airports, country)
        except Exception as e:
            logger.error(f"Error in crawler {crawler.country}: {e}")


if __name__ == "__main__":
    start = perf_counter()
    try:
        settings = Settings()  # type: ignore
        logger.setLevel(settings.log_level)
        # Erstelle ein Log-Format
        formatter = logging.Formatter(
            "%(asctime)s %(levelname)s [%(filename)s:%(lineno)s:%(funcName)s()] %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        )
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(formatter)
        file_handler = logging.FileHandler(settings.log_file)
        file_handler.setFormatter(formatter)

        if logger.hasHandlers():
            logger.handlers.clear()
        logger.addHandler(stream_handler)
        logger.addHandler(file_handler)

        main(sys.argv[1:])
    except ValidationError as e:
        for error in e.errors():
            print(error.get("msg"))

    end = perf_counter()
    logger.info(f"Finished crawling all countries in {end - start:.2f} seconds")
