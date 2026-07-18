"""Bulgaria (BULATSA) info-page crawler.

Bulgaria's official AIP + charts are published by **BULATSA** through the
registration-gated **b-flip** portal (`b-flip.bulatsa.com`); the services page
serves a login/registration form and there is no open AD-2 chart tree
(re-probed 16.07.2026), so we deliberately do NOT scrape charts (respecting the
access control). Bulgaria is onboarded as an **info-page** country: each
aerodrome gets a detail page with OpenAIP aerodrome data + live weather (both
filled by the website from the field's ICAO, no chart crawl needed), and the
primary blue "AIP" button links to the BULATSA b-flip AIP portal (a login /
registration may be required - the website shows a hint for gated countries).

The aerodrome LIST comes from OurAirports (public domain / CC0): the Bulgarian
(`iso_country = BG`) aerodromes with a real ICAO (LB**), emitted as `vfr` rows
whose `url` is the b-flip portal and with no `pdf_url` (so the website renders
no chart-PDF box). Pure HTTP, no login, no browser.
"""

import csv
import io

from crawlers.http_base import Airport, HttpCrawlerBase

COUNTRY = "BG"

# OurAirports airports export (stable GitHub Pages mirror), same source the
# facts importer uses. CC0 / public domain.
AIRPORTS_CSV = "https://davidmegginson.github.io/ourairports-data/airports.csv"

# BULATSA b-flip AIP portal (login / registration required). The website flags
# Bulgaria as a gated country so the detail page shows a "registration may be
# required" hint next to this button. Verified reachable from the self-hosted
# runner via the live-test `check_urls` step before launch.
BULATSA_AIP_URL = "https://b-flip.bulatsa.com/publications/aip/home"

# OurAirports `type` values that are real aerodromes (not closed / seaplane /
# balloonport / heliport - BG exposes VFR aerodromes only).
_AERODROME_TYPES = {"small_airport", "medium_airport", "large_airport"}


class BG(HttpCrawlerBase):
    """Bulgaria info-page crawler.

    No chart crawl (BULATSA charts are behind the b-flip registration): the
    aerodrome list is read from OurAirports and every field points at the
    b-flip AIP portal. OpenAIP facts + weather are added by the website per
    ICAO.
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
                        url=BULATSA_AIP_URL,
                        type="vfr",  # type: ignore[call-arg]
                    )
                )
        except Exception as e:
            self.logger.error(f"BG crawl failed: {e}")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
