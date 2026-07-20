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
import os
import sys
from time import perf_counter

from pydantic import ValidationError

from crawlers.al import AL
from crawlers.am import AM
from crawlers.at import AT
from crawlers.au import AU
from crawlers.az import AZ
from crawlers.ba import BA
from crawlers.be import BE
from crawlers.bg import BG
from crawlers.by import BY
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
from crawlers.ge import GE
from crawlers.gr import GR
from crawlers.hr import HR
from crawlers.hu import HU
from crawlers.ie import IE
from crawlers.is_ import IS
from crawlers.it import IT
from crawlers.kg import KG
from crawlers.kz import KZ
from crawlers.lt import LT
from crawlers.md import MD
from crawlers.mk import MK
from crawlers.mt import MT
from crawlers.nl import NL
from crawlers.no import NO
from crawlers.nz import NZ
from crawlers.pl import PL
from crawlers.pt import PT
from crawlers.ro import RO
from crawlers.rs import RS
from crawlers.ru import RU
from crawlers.se import SE
from crawlers.si import SI
from crawlers.sk import SK
from crawlers.tj import TJ
from crawlers.tm import TM
from crawlers.tr import TR
from crawlers.ua import UA
from crawlers.uk import UK
from crawlers.uz import UZ
from crawlers.xk import XK
from crawlers.http_eurocontrol_base import HttpEurocontrolBase
from output_handler import OutputHandler
from settings import Settings

logger = logging.getLogger()

# The active, scheduled crawlers, keyed by country code. `main.py` runs the
# whole set by default; pass country codes as CLI args to run a subset
# (e.g. `uv run main.py NL UK` to re-crawl only the Netherlands and the UK).
COUNTRY_CRAWLERS = {
    "AL": AL,
    "AM": AM,
    "AT": AT,
    "AU": AU,
    "AZ": AZ,
    "BA": BA,
    "BG": BG,
    "BY": BY,
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
    "GE": GE,
    "GR": GR,
    "HR": HR,
    "HU": HU,
    "IE": IE,
    "IS": IS,
    "IT": IT,
    "KG": KG,
    "KZ": KZ,
    "LT": LT,
    "MD": MD,
    "MK": MK,
    "MT": MT,
    "NO": NO,
    "NZ": NZ,
    "PL": PL,
    "PT": PT,
    "RO": RO,
    "RS": RS,
    "RU": RU,
    "SE": SE,
    "SI": SI,
    "SK": SK,
    "TJ": TJ,
    "TM": TM,
    "TR": TR,
    "UA": UA,
    "UZ": UZ,
    "XK": XK,
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
            # Collect the AUTHORITATIVE eAIP AD 2.3 operation hours for every
            # eurocontrol country (one extra fetch per field; fail-soft). NL
            # already primed its own hours during crawl(), so those are skipped.
            # Non-eurocontrol sources (DE/ES/GR/CIS info-pages) have no eAIP
            # AD 2.3 HTML and are left to OpenAIP hours.
            if isinstance(crawler, HttpEurocontrolBase):
                try:
                    crawler.collect_ad23_hours(airports)
                except Exception as e:
                    logger.warning(f"{country}: AD 2.3 hours collection failed: {e}")
            # `crawler.airac` is set only by crawlers that know their edition
            # date but store date-less URLs (DE); None for everyone else, where
            # the website derives the edition from the airport URLs.
            output_handler.write_output(
                airports, country, airac=crawler.airac
            )
            # Publish AUTHORITATIVE eAIP AD 2.3 operation hours + AD 2.13
            # declared distances, when the crawler collected them (PATCH,
            # source="eaip"; empty for crawlers that read neither). Fail-soft.
            hours_by_icao = getattr(crawler, "hours_by_icao", None)
            declared_by_icao = getattr(crawler, "declared_by_icao", None)
            if hours_by_icao or declared_by_icao:
                output_handler.publish_hours(
                    hours_by_icao or {}, country, declared_by_icao or {}
                )
            # DE-only: OCR the DFS AD-2 page images into raw DISPLAY text
            # (source "dfs-ocr") AND parse the AD 2.3 operator hours into
            # structured hours (source "dfs-ocr-hours"), which drive the same
            # badge / map / JSON-LD as eAIP countries under a "machine-read,
            # verify" disclaimer on the site (owner directive 20.07.2026).
            # Opt-in via DE_OCR (heavy: one browser render per field), never the
            # daily list crawl. Fully fail-soft.
            if os.environ.get("DE_OCR") and hasattr(crawler, "collect_ad2_ocr"):
                try:
                    crawler.collect_ad2_ocr(airports)
                    output_handler.publish_ad2_text(
                        getattr(crawler, "ad2_text_by_icao", {}),
                        country,
                        getattr(crawler, "ad2_text_de_by_icao", {}),
                    )
                    output_handler.publish_hours(
                        getattr(crawler, "hours_by_icao", {}),
                        country,
                        hours_source="dfs-ocr-hours",
                    )
                except Exception as e:
                    logger.warning(f"{country}: AD-2 OCR collection failed: {e}")
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
