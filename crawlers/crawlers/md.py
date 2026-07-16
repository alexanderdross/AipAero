"""Moldova (MOLDATSA) info-page crawler.

Moldova's official eAIP is published by MOLDATSA through the AIM portal
`aim.moldatsa.md`, which is a JavaScript application whose products sit behind
Home-Briefing registration (no open, static chart tree is exposed) - so, like
Switzerland, Moldova is onboarded as an **info-page** country: each aerodrome
gets a detail page with OpenAIP data + live weather (filled by the website from
the ICAO, no chart crawl), and the blue "AIP" button links to the MOLDATSA AIM
portal (registration may be required).

The aerodrome LIST comes from OurAirports (public domain / CC0): the Moldovan
(`iso_country = MD`) aerodromes with a real ICAO (LU**), emitted as `vfr` rows
whose `url` is the AIM portal and with no `pdf_url`. Pure HTTP, no login, no
browser. LU is the Moldova ICAO prefix.
"""

import csv
import io

from crawlers.http_base import Airport, HttpCrawlerBase

COUNTRY = "MD"

AIRPORTS_CSV = "https://davidmegginson.github.io/ourairports-data/airports.csv"

# MOLDATSA AIM portal (Home-Briefing registration may be required). Verified 200
# from the runner via the live-test `check_urls` step before launch; Moldova is
# a gated country so the detail page shows a "registration may be required" hint.
MOLDATSA_AIM_URL = "https://aim.moldatsa.md/"

_AERODROME_TYPES = {"small_airport", "medium_airport", "large_airport"}


class MD(HttpCrawlerBase):
    """Moldova info-page crawler.

    No chart crawl (the MOLDATSA AIM portal is registration-gated / not an open
    chart tree): the aerodrome list is read from OurAirports and every field
    points at the AIM portal. OpenAIP facts + weather are added by the website.
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
                        url=MOLDATSA_AIM_URL,
                        type="vfr",  # type: ignore[call-arg]
                    )
                )
        except Exception as e:
            self.logger.error(f"MD crawl failed: {e}")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
