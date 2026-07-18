"""Azerbaijan (AZANS) info-page crawler.

Azerbaijan's AIP is published under the authority of the **State Civil Aviation
Agency** (`caa.gov.az`); the originator is AIS "Azeraeronavigation" (AZANS). There
is no discoverable open, current eAIP with downloadable charts - the only public
eAIP artifacts are a stale 2016 third-party mirror, and Eurocontrol's AIS-online
list carries no website link for AZ. So we deliberately do NOT scrape charts and
onboard Azerbaijan as an **info-page** country (the CH/IT/MT pattern): each
aerodrome gets a detail page with OpenAIP aerodrome data + live weather (filled by
the website from the field's ICAO, no chart crawl), and the primary blue "AIP"
button links to the State Civil Aviation Agency (a login / registration may be
required - the website shows the gated-country hint).

The aerodrome LIST comes from OurAirports (public domain / CC0): the Azerbaijani
(`iso_country = AZ`) aerodromes with a real ICAO (UB**), emitted as `vfr` rows
whose `url` is the authority site and with no `pdf_url`. Pure HTTP, no login.
"""

import csv
import io

from crawlers.http_base import Airport, HttpCrawlerBase

COUNTRY = "AZ"

# OurAirports airports export (stable GitHub Pages mirror), CC0 / public domain.
AIRPORTS_CSV = "https://davidmegginson.github.io/ourairports-data/airports.csv"

# Azerbaijan State Civil Aviation Agency (the AIP authority; the eAIP itself is
# not openly published). The website flags Azerbaijan as a gated country so the
# detail page shows a "registration may be required" hint next to this button.
# Verified reachable from the self-hosted runner via the live-test `check_urls`.
CAA_AIP_URL = "https://www.caa.gov.az/"

# OurAirports `type` values that are real aerodromes.
_AERODROME_TYPES = {"small_airport", "medium_airport", "large_airport"}


class AZ(HttpCrawlerBase):
    """Azerbaijan info-page crawler.

    No chart crawl (no open eAIP): the aerodrome list is read from OurAirports
    and every field points at the CAA AIP portal. OpenAIP facts + weather are
    added by the website per ICAO.
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
                        url=CAA_AIP_URL,
                        type="vfr",  # type: ignore[call-arg]
                    )
                )
        except Exception as e:
            self.logger.error(f"AZ crawl failed: {e}")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
