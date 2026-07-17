"""Turkey (DHMI) info-page crawler.

Turkey's official AIP + charts are published by **DHMI** (Devlet Hava
Meydanlari Isletmesi) through the login + paid-subscription **AIP Turkiye**
portal (`dhmi.gov.tr/Sayfalar/aipturkey.aspx` - a JavaScript/SharePoint page
whose AIP Download / subscription area requires authentication; re-probed
17.07.2026, no open AD-2 pages and no downloadable charts), so we deliberately
do NOT scrape charts (respecting the access control). Turkey is onboarded as an
**info-page** country: each aerodrome gets a detail page with OpenAIP aerodrome
data + live weather (both filled by the website from the field's ICAO, no chart
crawl needed), and the primary blue "AIP" button links to the DHMI AIP Turkiye
portal (a login / subscription may be required - the website shows a hint for
gated countries).

The aerodrome LIST comes from OurAirports (public domain / CC0): the Turkish
(`iso_country = TR`) aerodromes with a real ICAO (LT**), emitted as `vfr` rows
whose `url` is the DHMI portal and with no `pdf_url` (so the website renders no
chart-PDF box). Pure HTTP, no login, no browser.
"""

import csv
import io

from crawlers.http_base import Airport, HttpCrawlerBase

COUNTRY = "TR"

# OurAirports airports export (stable GitHub Pages mirror), same source the
# facts importer uses. CC0 / public domain.
AIRPORTS_CSV = "https://davidmegginson.github.io/ourairports-data/airports.csv"

# DHMI AIP Turkiye portal (login + paid subscription required for downloads).
# The website flags Turkey as a gated country so the detail page shows a
# "registration may be required" hint next to this button. Verified reachable
# (HTTP 200) from the self-hosted runner via the live-test `dump_url` step.
DHMI_AIP_URL = "https://dhmi.gov.tr/Sayfalar/aipturkey.aspx"

# OurAirports `type` values that are real aerodromes (not closed / seaplane /
# balloonport / heliport - TR exposes VFR aerodromes only).
_AERODROME_TYPES = {"small_airport", "medium_airport", "large_airport"}


class TR(HttpCrawlerBase):
    """Turkey info-page crawler.

    No chart crawl (DHMI charts are behind the AIP Turkiye subscription): the
    aerodrome list is read from OurAirports and every field points at the DHMI
    AIP portal. OpenAIP facts + weather are added by the website per ICAO.
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
                        url=DHMI_AIP_URL,
                        type="vfr",  # type: ignore[call-arg]
                    )
                )
        except Exception as e:
            self.logger.error(f"TR crawl failed: {e}")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
