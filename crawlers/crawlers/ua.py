"""Ukraine (UkSATSE) info-page crawler.

Ukraine's official AIP is published by **UkSATSE** through its AIS unit
(`aisukraine.net`). The eAIP itself is sold as an **annual subscription** (there
is no open AD-2 HTML frameset or free chart PDFs - only AICs/circulars sit in the
open `current/` folder), so we deliberately do NOT scrape charts (respecting the
access control). On top of that, Ukrainian civil airspace has been closed by
NOTAM since 24 Feb 2022, so the AIP is not operationally live for GA - all the
more reason to link the official publication rather than mirror it.

Ukraine is therefore onboarded as an **info-page** country (the CH/IT/MT pattern):
each aerodrome gets a detail page with OpenAIP aerodrome data + live weather
(filled by the website from the field's ICAO, no chart crawl), and the primary
blue "AIP" button links to the UkSATSE AIS portal (login / registration may be
required - the website shows the gated-country hint).

The aerodrome LIST comes from OurAirports (public domain / CC0): the Ukrainian
(`iso_country = UA`) aerodromes with a real ICAO (UK**), emitted as `vfr` rows
whose `url` is the AIS portal and with no `pdf_url`. Pure HTTP, no login.
"""

import csv
import io

from crawlers.http_base import Airport, HttpCrawlerBase

COUNTRY = "UA"

# OurAirports airports export (stable GitHub Pages mirror), CC0 / public domain.
AIRPORTS_CSV = "https://davidmegginson.github.io/ourairports-data/airports.csv"

# UkSATSE Aeronautical Information Service portal (the open eAIP is behind a
# paid subscription). The website flags Ukraine as a gated country so the detail
# page shows a "registration may be required" hint next to this button. Verified
# reachable from the self-hosted runner via the live-test `check_urls` step.
AIS_URL = "https://www.aisukraine.net/"

# OurAirports `type` values that are real aerodromes (not closed / seaplane /
# balloonport / heliport).
_AERODROME_TYPES = {"small_airport", "medium_airport", "large_airport"}


class UA(HttpCrawlerBase):
    """Ukraine info-page crawler.

    No chart crawl (the UkSATSE eAIP is subscription-gated): the aerodrome list
    is read from OurAirports and every field points at the AIS portal. OpenAIP
    facts + weather are added by the website per ICAO.
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
                        url=AIS_URL,
                        type="vfr",  # type: ignore[call-arg]
                    )
                )
        except Exception as e:
            self.logger.error(f"UA crawl failed: {e}")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
