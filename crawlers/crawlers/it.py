"""Italy (ENAV) info-page crawler.

Italy's official AIP and charts are published by **ENAV** through the login-only
**Self Briefing** portal - there is no open eurocontrol eAIP (`www.enav.it/eAIP/`
404s, `aip.enav.it` does not resolve), so we deliberately do NOT scrape charts
(respecting the access control). Italy is onboarded as an **info-page** country:
each aerodrome gets a detail page with OpenAIP aerodrome data + live weather
(both filled by the website from the field's ICAO, no chart crawl needed), and
the primary blue "AIP" button links to the ENAV Self Briefing portal (a login /
registration may be required - the website shows a hint for gated countries).

The aerodrome LIST comes from OurAirports (public domain / CC0): the Italian
(`iso_country = IT`) aerodromes with a real ICAO (LI**), emitted as `vfr` rows
whose `url` is the ENAV portal and with no `pdf_url` (so the website renders no
chart-PDF box). Pure HTTP, no login, no browser.
"""

import csv
import io

from crawlers.http_base import Airport, HttpCrawlerBase

COUNTRY = "IT"

# OurAirports airports export (stable GitHub Pages mirror), same source the
# facts importer uses. CC0 / public domain.
AIRPORTS_CSV = "https://davidmegginson.github.io/ourairports-data/airports.csv"

# ENAV Self Briefing portal (login / registration required). The website flags
# Italy as a gated country so the detail page shows a "registration may be
# required" hint next to this button. Verified reachable from the self-hosted
# runner via the live-test `check_urls` step before launch.
ENAV_AIP_URL = "https://www.enav.it/cosa-facciamo/spazio-aereo/self-briefing"

# OurAirports `type` values that are real aerodromes (not closed / seaplane /
# balloonport / heliport - IT exposes VFR aerodromes only).
_AERODROME_TYPES = {"small_airport", "medium_airport", "large_airport"}


class IT(HttpCrawlerBase):
    """Italy info-page crawler.

    No chart crawl (ENAV charts are behind the Self Briefing login): the
    aerodrome list is read from OurAirports and every field points at the ENAV
    AIP portal. OpenAIP facts + weather are added by the website per ICAO.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    @staticmethod
    def _icao(row: dict[str, str]) -> str | None:
        """Best-effort ICAO for an OurAirports row (icao_code, else a 4-letter
        ident), upper-cased; None when neither is a plain 4-letter code."""
        for key in ("icao_code", "ident"):
            code = (row.get(key) or "").strip().upper()
            if len(code) == 4 and code.isalpha():
                return code
        return None

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []

        try:
            # OurAirports CSV is text, not the eAIP HTML the base's fetch()
            # expects - read it through the raw pooled client (which follows
            # the GitHub Pages redirect) and parse it.
            resp = self.client.get(AIRPORTS_CSV, timeout=60)
            resp.raise_for_status()
            rows = list(csv.DictReader(io.StringIO(resp.text)))

            seen: set[str] = set()
            for row in rows:
                if (row.get("iso_country") or "").strip().upper() != COUNTRY:
                    continue
                if (row.get("type") or "").strip() not in _AERODROME_TYPES:
                    continue
                icao = self._icao(row)
                if not icao or icao in seen:
                    continue
                seen.add(icao)
                # Title convention across the site is "<name> <ICAO>" (shown on
                # the map label, the list and the detail heading). Append the
                # ICAO to the OurAirports name; fall back to the bare code when
                # the name is missing (never "<ICAO> <ICAO>").
                name = (row.get("name") or "").strip()
                title = f"{name} {icao}" if name else icao
                airports.append(
                    Airport(
                        country=COUNTRY,
                        icao=icao,
                        title=title,
                        url=ENAV_AIP_URL,
                        type="vfr",  # type: ignore[call-arg]
                    )
                )
        except Exception as e:
            self.logger.error(f"IT crawl failed: {e}")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
