"""Switzerland (skybriefing / skyguide) info-page crawler.

Switzerland's official AIP and VFR/approach charts are published by
**skybriefing** (a skyguide company) behind a customer login - they are NOT
freely downloadable, so we deliberately do NOT scrape charts (respecting the
access control). Instead Switzerland is onboarded as an **info-page** country:
each aerodrome gets a detail page with OpenAIP aerodrome data + live weather
(both filled by the website from the field's ICAO, no chart crawl needed), and
the primary blue "AIP" button links to the skybriefing AIP portal (a login /
registration may be required - the website shows a hint for gated countries).

The aerodrome LIST comes from OurAirports (public domain / CC0): the Swiss
(`iso_country = CH`) aerodromes with a real ICAO (LS**), emitted as `vfr` rows
whose `url` is the skybriefing portal and with no `pdf_url` (so the website
renders no chart-PDF box). Pure HTTP, no login, no browser.
"""

import csv
import io

from crawlers.http_base import Airport, HttpCrawlerBase

COUNTRY = "CH"

# OurAirports airports export (stable GitHub Pages mirror), same source the
# facts importer uses. CC0 / public domain.
AIRPORTS_CSV = "https://davidmegginson.github.io/ourairports-data/airports.csv"

# skybriefing AIP portal (login / registration may be required). Verified 200
# from the self-hosted runner via the live-test `check_urls` step before launch;
# the website flags Switzerland as a gated country so the detail page shows a
# "registration may be required" hint next to this button.
SKYBRIEFING_AIP_URL = "https://www.skybriefing.com/en/aip"

# OurAirports `type` values that are real aerodromes (not closed / seaplane /
# balloonport / heliport - CH exposes VFR aerodromes only).
_AERODROME_TYPES = {"small_airport", "medium_airport", "large_airport"}


class CH(HttpCrawlerBase):
    """Switzerland info-page crawler.

    No chart crawl (skybriefing charts are paywalled): the aerodrome list is
    read from OurAirports and every field points at the skybriefing AIP portal.
    OpenAIP facts + weather are added by the website per ICAO.
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
                name = (row.get("name") or "").strip() or icao
                airports.append(
                    Airport(
                        country=COUNTRY,
                        icao=icao,
                        title=name,
                        url=SKYBRIEFING_AIP_URL,
                        type="vfr",  # type: ignore[call-arg]
                    )
                )
        except Exception as e:
            self.logger.error(f"CH crawl failed: {e}")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
