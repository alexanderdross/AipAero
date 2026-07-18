"""Belarus (Belaeronavigatsia) info-page crawler.

Belarus's official AIP is published by **Belaeronavigatsia** (`ban.by`). The
portal presents the eAIP behind registration - it offers "Free eAIP" and "Paid
eAIP" *subscription* options (a registration wall even for the free tier), so we
respect the access control and do NOT scrape charts. Belarus is onboarded as an
**info-page** country (the CH/IT/UA pattern): each aerodrome gets a detail page
with OpenAIP aerodrome data + live weather (filled by the website from the field's
ICAO, no chart crawl), and the primary blue "AIP" button links to the
Belaeronavigatsia AIP portal (a login / registration may be required - the website
shows the gated-country hint).

The aerodrome LIST comes from OurAirports (public domain / CC0): the Belarusian
(`iso_country = BY`) aerodromes with a real ICAO (UM**), emitted as `vfr` rows
whose `url` is the AIP portal and with no `pdf_url`. Pure HTTP, no login.
"""

import csv
import io

from crawlers.http_base import Airport, HttpCrawlerBase

COUNTRY = "BY"

# OurAirports airports export (stable GitHub Pages mirror), CC0 / public domain.
AIRPORTS_CSV = "https://davidmegginson.github.io/ourairports-data/airports.csv"

# Belaeronavigatsia AIP portal (the eAIP is registration/subscription-gated). The
# website flags Belarus as a gated country so the detail page shows a
# "registration may be required" hint next to this button. Verified reachable
# from the self-hosted runner (HTTP 200) via the live-test probe.
AIP_URL = "https://www.ban.by/en/aeronautical-information-aip"

# OurAirports `type` values that are real aerodromes.
_AERODROME_TYPES = {"small_airport", "medium_airport", "large_airport"}


class BY(HttpCrawlerBase):
    """Belarus info-page crawler.

    No chart crawl (the ban.by eAIP is registration-gated): the aerodrome list is
    read from OurAirports and every field points at the Belaeronavigatsia AIP
    portal. OpenAIP facts + weather are added by the website per ICAO.
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
            self.logger.error(f"BY crawl failed: {e}")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
