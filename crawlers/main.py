"""Crawler subsystem entry point.

Wires the whole scraping run together: it holds the `COUNTRY_CRAWLERS`
registry (the active, scheduled crawlers keyed by country code), parses the
optional CLI country selection, configures logging, then for each selected
country runs `crawler.crawl()` and hands the result to `OutputHandler`, which
POSTs it to the website's `/api/airports` endpoint. Run by the daily GitHub
Actions workflow (`.github/workflows/crawl.yml`) or manually with
`uv run main.py [CC ...]`.
"""

import logging
import sys
from time import perf_counter

from pydantic import ValidationError

from crawlers.al import AL
from crawlers.at import AT
from crawlers.ba import BA
from crawlers.be import BE
from crawlers.bg import BG
from crawlers.ch import CH
from crawlers.cy import CY
from crawlers.cz import CZ
from crawlers.de import DE
from crawlers.ee import EE
from crawlers.es import ES
from crawlers.fi import FI
from crawlers.lv import LV
from crawlers.dk import DK
from crawlers.fr import FR
from crawlers.gr import GR
from crawlers.hr import HR
from crawlers.hu import HU
from crawlers.ie import IE
from crawlers.is_ import IS
from crawlers.it import IT
from crawlers.lt import LT
from crawlers.md import MD
from crawlers.mk import MK
from crawlers.mt import MT
from crawlers.nl import NL
from crawlers.no import NO
from crawlers.pl import PL
from crawlers.pt import PT
from crawlers.ro import RO
from crawlers.rs import RS
from crawlers.se import SE
from crawlers.si import SI
from crawlers.sk import SK
from crawlers.tr import TR
from crawlers.uk import UK
from output_handler import OutputHandler
from settings import Settings

logger = logging.getLogger()

# The active, scheduled crawlers, keyed by country code. `main.py` runs the
# whole set by default; pass country codes as CLI args to run a subset
# (e.g. `uv run main.py NL UK` to re-crawl only the Netherlands and the UK).
COUNTRY_CRAWLERS = {
    "AL": AL,
    "AT": AT,
    "BA": BA,
    "BG": BG,
    "CH": CH,
    "CY": CY,
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
    "HR": HR,
    "HU": HU,
    "IE": IE,
    "IS": IS,
    "IT": IT,
    "LT": LT,
    "MD": MD,
    "MK": MK,
    "MT": MT,
    "NO": NO,
    "PL": PL,
    "PT": PT,
    "RO": RO,
    "RS": RS,
    "SE": SE,
    "SI": SI,
    "SK": SK,
    "TR": TR,
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
    """Crawl the selected countries and publish each result independently.

    One shared `OutputHandler` fans every country's airports out to the API.
    Each crawler is isolated in its own try/except so a single country failing
    (network error, markup drift) never aborts the rest of the run.
    """
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
            # Time the scrape purely for the run log; then publish this
            # country's airports before moving on to the next crawler.
            start = perf_counter()
            airports = crawler.crawl()
            country = crawler.country
            end = perf_counter()
            logger.info(f"Finished crawling {country} in {end - start:.2f} seconds")
            # `crawler.airac` is set only by crawlers that know their edition
            # date but store date-less URLs (DE); None for everyone else, where
            # the website derives the edition from the airport URLs.
            output_handler.write_output(
                airports, country, airac=crawler.airac
            )
        except Exception as e:
            # Per-country isolation: log and continue with the next crawler.
            logger.error(f"Error in crawler {crawler.country}: {e}")


if __name__ == "__main__":
    start = perf_counter()
    try:
        # Load env-based config first; an invalid/missing var raises
        # ValidationError, handled below, so the run fails with a clear message.
        settings = Settings()  # type: ignore
        logger.setLevel(settings.log_level)
        # Build the log format (timestamp, level, source location, message).
        formatter = logging.Formatter(
            "%(asctime)s %(levelname)s [%(filename)s:%(lineno)s:%(funcName)s()] %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        )
        # Log to both stdout (Actions run log) and a file (settings.log_file).
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(formatter)
        file_handler = logging.FileHandler(settings.log_file)
        file_handler.setFormatter(formatter)

        # Reset any inherited handlers so lines aren't duplicated on re-runs.
        if logger.hasHandlers():
            logger.handlers.clear()
        logger.addHandler(stream_handler)
        logger.addHandler(file_handler)

        # sys.argv[1:] are the optional country codes to crawl (empty = all).
        main(sys.argv[1:])
    except ValidationError as e:
        # Missing/invalid Settings env vars: print each message, don't crash.
        for error in e.errors():
            print(error.get("msg"))

    end = perf_counter()
    logger.info(f"Finished crawling all countries in {end - start:.2f} seconds")
