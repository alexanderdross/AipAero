from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "PL"
# PANSA (Polska Agencja Żeglugi Powietrznej / Polish Air Navigation Services
# Agency) AIS eAIP. The public entry point is https://www.ais.pansa.pl/; the
# eAIP itself is a EUROCONTROL-style static frameset. The exact index path
# below is a BEST-EFFORT guess and MUST be verified against the live site.
ROOT_URL = "https://www.ais.pansa.pl/aip/EP-eAIP/html/index-en-GB.html"


class PL(HttpEurocontrolBase):
    """Poland AIP crawler — BEST-EFFORT / UNVERIFIED (no task spec).

    There is no task spec for Poland, so both the endpoint and the extraction
    rules below are assumptions modelled on the Netherlands crawler and MUST be
    validated against the live PANSA eAIP before enabling this crawler:

      * ``ROOT_URL`` — the real PANSA eAIP index URL / current-edition entry
        point. PANSA may front the eAIP behind a dated-edition landing page (as
        LVNL/NATS do); if so, resolve the effective edition first (see nl.py's
        ``_resolve_edition_url``) before walking the frame chain.
      * The frame names passed to ``follow_frame_chain`` — the standard
        EUROCONTROL frameset uses ``eAISNavigationBase`` → ``eAISNavigation``,
        but this must be confirmed for the PL eAIP.
      * The menu section-id suffixes passed to
        ``extract_airports_from_html`` — ``"AD 2en-GBdetails"`` (aerodromes) and
        ``"AD 3en-GBdetails"`` (heliports). Different eAIP builds vary the exact
        id text (spacing / locale suffix); adjust after inspecting a saved
        ``eAISNavigation`` document.

    Type mapping (per the shared spec for spec-less countries):
        AD-2 → vfr, AD-3 → heliport.

    Import-clean: no network work happens at import or in ``__init__``.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. Walk the frame chain to the navigation HTML.
            #    (If PANSA lists dated editions on ROOT_URL, resolve the current
            #    edition first — see nl.py's _resolve_edition_url — before this.)
            nav_url, nav_html = self.follow_frame_chain(
                ROOT_URL, ["eAISNavigationBase", "eAISNavigation"]
            )
            last_url, last_html = nav_url, nav_html

            # 2. Extract aerodromes (AD 2 → vfr) and heliports (AD 3 → heliport).
            airports.extend(
                self.extract_airports_from_html(
                    nav_html, nav_url, "AD 2en-GBdetails", "vfr"
                )
            )
            airports.extend(
                self.extract_airports_from_html(
                    nav_html, nav_url, "AD 3en-GBdetails", "heliport"
                )
            )
        except Exception as e:
            self.logger.error(f"PL crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
