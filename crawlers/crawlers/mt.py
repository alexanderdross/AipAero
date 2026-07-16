"""Malta (Transport Malta / MATS) info-page crawler.

Malta's official AIP and aerodrome charts are published by the Civil Aviation
Directorate (Transport Malta) and MATS through the `maltats.com/aim` portal /
the Transport Malta AIP page; the full AIP is NOT served as an open, static
chart tree (the `/aip/` path 404s and the AIS portal is a JavaScript
application), so - like Switzerland - Malta is onboarded as an **info-page**
country: each aerodrome gets a detail page with OpenAIP data + live weather
(filled by the website from the ICAO, no chart crawl), and the blue "AIP"
button links to the official Transport Malta AIP page.

The aerodrome LIST comes from OurAirports (public domain / CC0): the Maltese
(`iso_country = MT`) aerodromes with a real ICAO (LM**), emitted as `vfr` rows
whose `url` is the AIP page and with no `pdf_url`. Pure HTTP, no login, no
browser. LM is the Malta ICAO prefix.
"""

import csv
import io

from crawlers.http_base import Airport, HttpCrawlerBase

COUNTRY = "MT"

AIRPORTS_CSV = "https://davidmegginson.github.io/ourairports-data/airports.csv"

# Official Transport Malta AIP page (Civil Aviation Directorate). Verified 200
# from the runner via the live-test `check_urls` step before launch; Malta is a
# gated country so the detail page shows a "registration may be required" hint.
MALTA_AIP_URL = (
    "https://www.transport.gov.mt/aviation/"
    "air-navigation-services-aerodromes/"
    "aeronautical-information-publication-3764"
)

_AERODROME_TYPES = {"small_airport", "medium_airport", "large_airport"}


class MT(HttpCrawlerBase):
    """Malta info-page crawler.

    No chart crawl (the MATS AIP portal is a JS app / not an open chart tree):
    the aerodrome list is read from OurAirports and every field points at the
    Transport Malta AIP page. OpenAIP facts + weather are added by the website.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    @staticmethod
    def _icao(row: dict[str, str]) -> str | None:
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
                name = (row.get("name") or "").strip()
                title = f"{name} {icao}" if name else icao
                airports.append(
                    Airport(
                        country=COUNTRY,
                        icao=icao,
                        title=title,
                        url=MALTA_AIP_URL,
                        type="vfr",  # type: ignore[call-arg]
                    )
                )
        except Exception as e:
            self.logger.error(f"MT crawl failed: {e}")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
