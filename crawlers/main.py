import logging
from time import perf_counter

from pydantic import ValidationError

from crawlers.at import AT
from crawlers.car_sam_nam import CarSamNam
from crawlers.de import DE
from crawlers.fr import FR
from crawlers.nl import NL
from crawlers.pac_n import PacN
from crawlers.pac_p import PacP
from crawlers.run import RUN
from crawlers.uk import UK
from output_handler import OutputHandler
from settings import Settings

logger = logging.getLogger()


def main():
    logger.info("Starting crawling process")
    # crawlers = [AT(), DE(), FR(), NL(), UK()]
    crawlers = [NL()]
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

        main()
    except ValidationError as e:
        for error in e.errors():
            print(error.get("msg"))

    end = perf_counter()
    logger.info(f"Finished crawling all countries in {end - start:.2f} seconds")
