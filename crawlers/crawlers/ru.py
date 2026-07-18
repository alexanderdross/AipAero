"""Russia (CAICA (Center of Aeronautical Information; publishes "AIP Russia")) info-page crawler.

Russia's official AIP is published by CAICA (Center of Aeronautical Information; publishes "AIP Russia"). However the aerodrome navigation is a client-side JavaScript "DHTML-menu" (the static HTML exposes no AD-2 / chart-PDF links), so the chart tree is not statically crawlable - and we
deliberately do NOT run a browser to reverse-engineer it, so Russia is onboarded
as an **info-page** country (the CH/IT/TR pattern): each aerodrome gets a detail
page with OpenAIP aerodrome data + live weather (filled by the website from the
field's ICAO, no chart crawl), and the primary blue "AIP" button links to the
official AIP portal (a login / registration may be required - the website shows
the gated-country hint).

The aerodrome LIST comes from OurAirports (public domain / CC0): the Russia
(`iso_country = RU`) aerodromes with a real ICAO (U** (a very large range)), emitted as `vfr` rows
whose `url` is the AIP portal and with no `pdf_url`. Pure HTTP, no login, no browser.
"""

import csv
import io

from crawlers.http_base import Airport, HttpCrawlerBase

COUNTRY = "RU"

# OurAirports airports export (stable GitHub Pages mirror), CC0 / public domain.
AIRPORTS_CSV = "https://davidmegginson.github.io/ourairports-data/airports.csv"

# Official AIP portal. The website flags RU as a gated country so the detail
# page shows a "registration may be required" hint next to this button. The
# aerodrome charts exist but are only reachable through this JS portal, not a
# static tree. Verified reachable from the self-hosted runner (live-test).
AIP_URL = "https://www.caica.ru/common/AirInter/validaip/html/eng.htm"

# OurAirports `type` values that are real aerodromes.
_AERODROME_TYPES = {"small_airport", "medium_airport", "large_airport"}


class RU(HttpCrawlerBase):
    """Russia info-page crawler.

    No chart crawl (CAICA JS DHTML menu): the aerodrome list is read from OurAirports and
    every field points at the AIP portal. OpenAIP facts + weather are added by
    the website per ICAO.
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
                # Title convention across the site is "<name> <ICAO>".
                name = (row.get("name") or "").strip()
                title = f"{name} {icao}" if name else icao
                airports.append(
                    Airport(
                        country=COUNTRY,
                        icao=icao,
                        title=title,
                        url=AIP_URL,
                        type="vfr",  # type: ignore[call-arg]
                    )
                )
        except Exception as e:
            self.logger.error(f"RU crawl failed: {e}")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
