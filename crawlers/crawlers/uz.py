"""Uzbekistan (Uzaeronavigation) info-page crawler.

Uzbekistan's AIP is published by **Uzaeronavigation** (`uzaeronavigation.com`).
The AIS navigation index (`/ais/`) is registration/subscription-gated, and while
individual chart PDFs are served openly they are keyed by unguessable hash
filenames (no enumerable static tree without the gated index), so we deliberately
do NOT scrape charts. Uzbekistan is onboarded as an **info-page** country (the
CH/IT/MT pattern): each aerodrome gets a detail page with OpenAIP aerodrome data +
live weather (filled by the website from the field's ICAO, no chart crawl), and
the primary blue "AIP" button links to the Uzaeronavigation AIP portal (a login /
registration may be required - the website shows the gated-country hint).

The aerodrome LIST comes from OurAirports (public domain / CC0): the Uzbek
(`iso_country = UZ`) aerodromes with a real ICAO, emitted as `vfr` rows whose
`url` is the AIS portal and with no `pdf_url`. Pure HTTP, no login.

ICAO note: Uzbekistan migrated from the `UT**` block to a dedicated `UZ**` block
on 02 Oct 2025 (e.g. UTTT Tashkent -> UZTT). The list follows whatever OurAirports
currently carries, so the site tracks the migration as OurAirports updates.
"""

import csv
import io

from crawlers.http_base import Airport, HttpCrawlerBase

COUNTRY = "UZ"

# OurAirports airports export (stable GitHub Pages mirror), CC0 / public domain.
AIRPORTS_CSV = "https://davidmegginson.github.io/ourairports-data/airports.csv"

# Uzaeronavigation AIP / AIS portal (registration/subscription-gated index). The
# website flags Uzbekistan as a gated country so the detail page shows a
# "registration may be required" hint next to this button. Verified reachable
# from the self-hosted runner via the live-test `check_urls` step.
AIS_URL = "https://uzaeronavigation.com/ais/"

# OurAirports `type` values that are real aerodromes.
_AERODROME_TYPES = {"small_airport", "medium_airport", "large_airport"}


class UZ(HttpCrawlerBase):
    """Uzbekistan info-page crawler.

    No chart crawl (the AIS index is gated and chart PDFs are hash-keyed): the
    aerodrome list is read from OurAirports and every field points at the
    Uzaeronavigation AIP portal. OpenAIP facts + weather are added by the
    website per ICAO.
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
            self.logger.error(f"UZ crawl failed: {e}")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
