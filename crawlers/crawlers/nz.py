"""New Zealand (Aeropath / Airways) info-page crawler.

New Zealand's official AIP and aerodrome charts are published free of charge on
the **aip.net.nz** portal (Aeropath / Airways) - but the site is an ASP.NET
WebForms application sitting behind an **Incapsula/Imperva bot-protection WAF**:
a plain HTTP client receives the WAF JS challenge, not the chart tree, and there
is no static, enumerable chart-PDF index. Rather than defeat the bot gate, New
Zealand is onboarded as an **info-page** country: each aerodrome gets a detail
page with OpenAIP aerodrome data + live weather (both filled by the website from
the field's ICAO, no chart crawl needed), and the primary blue "AIP" button
links to the free aip.net.nz portal (where a pilot can open the charts in a real
browser).

The aerodrome LIST comes from OurAirports (public domain / CC0): the New Zealand
(`iso_country = NZ`) aerodromes with a real ICAO (NZ**), emitted as `vfr` rows
whose `url` is the aip.net.nz portal and with no `pdf_url` (so the website
renders no chart-PDF box). Pure HTTP, no login, no browser.
"""

import csv
import io

from crawlers.http_base import Airport, HttpCrawlerBase

COUNTRY = "NZ"

# OurAirports airports export (stable GitHub Pages mirror), same source the
# facts importer uses. CC0 / public domain.
AIRPORTS_CSV = "https://davidmegginson.github.io/ourairports-data/airports.csv"

# aip.net.nz AIP portal (free, no login - the charts are viewable there in a
# real browser; the portal itself is WAF-protected so we do not crawl it).
# Verify 200/humanly-reachable from the runner before launch.
AIP_NZ_URL = "https://www.aip.net.nz/"

# OurAirports `type` values that are real aerodromes (not closed / seaplane /
# balloonport / heliport).
_AERODROME_TYPES = {"small_airport", "medium_airport", "large_airport"}


class NZ(HttpCrawlerBase):
    """New Zealand info-page crawler.

    No chart crawl (aip.net.nz is WAF-gated with no static chart index): the
    aerodrome list is read from OurAirports and every field points at the
    aip.net.nz portal. OpenAIP facts + weather are added by the website per ICAO.
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
                        url=AIP_NZ_URL,
                        type="vfr",  # type: ignore[call-arg]
                    )
                )
        except Exception as e:
            self.logger.error(f"NZ crawl failed: {e}")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
