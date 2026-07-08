"""Germany AIP crawler.

DFS publishes two parallel sites: BasicVFR (https://aip.dfs.de/BasicVFR/)
and BasicIFR (https://aip.dfs.de/BasicIFR/). Both expose stable, static,
case-sensitive page URLs of the form `…/pages/CNNNNN.html`. We enter each
fork directly at its section index page instead of matching English link
text ("AD Aerodromes", "AD 2 Aerodromes", …) on the landing page, which
broke whenever DFS retitled or relocated a link.

    BasicVFR/pages/C0004A.html  →  AD aerodromes      → letter-grouped pages → leaf pages
    BasicVFR/pages/C00067.html  →  HEL AD heliports   → letter-grouped pages → leaf pages
    BasicIFR/pages/C000C0.html  →  AD 2 aerodromes    → leaf pages
    BasicIFR/pages/C01C60.html  →  AD 3 heliports     → leaf pages

Title and ICAO extraction differs per fork:
  - VFR leaves embed the title (with trailing 4-letter ICAO) in a span
    inside the `<a class="folder-link">`.
  - IFR leaves carry the city in `div.headlineText.left > span` and the
    ICAO in `a.document-link > span.document-name`.

The type mapping (VFR aerodromes → vfr, VFR heliports → heliport, IFR
aerodromes → ifr, IFR heliports → heliport) mirrors the published list at
https://aip.aero/de/flughafen-liste-deutschland/ and must not change.
"""

from __future__ import annotations

import re
from typing import Literal
from urllib.parse import urljoin

from crawlers.http_base import Airport, HttpCrawlerBase

COUNTRY = "DE"

# Static section index pages (case-sensitive; DFS serves capital "Basic").
# VFR:
VFR_AERODROMES_URL = "https://aip.dfs.de/BasicVFR/pages/C0004A.html"
VFR_HELIPORTS_URL = "https://aip.dfs.de/BasicVFR/pages/C00067.html"
# IFR:
IFR_AERODROMES_URL = "https://aip.dfs.de/BasicIFR/pages/C000C0.html"  # AD 2
IFR_HELIPORTS_URL = "https://aip.dfs.de/BasicIFR/pages/C01C60.html"  # AD 3

_ICAO_TRAILING = re.compile(r"([A-Z]{4})$")
_ICAO_ANYWHERE = re.compile(r"([A-Z]{4})")


class DE(HttpCrawlerBase):
    def __init__(self) -> None:
        super().__init__(COUNTRY)

    # ----- helpers ------------------------------------------------------------

    def folder_link_hrefs(self, html: str) -> list[str]:
        """All hrefs from `<a class="folder-link">` elements, in document order."""
        return [
            a["href"]
            for a in self.soup(html).find_all("a", class_="folder-link")
            if a.get("href")
        ]

    # ----- VFR ----------------------------------------------------------------

    def _process_vfr(self, airports: list[Airport]) -> None:
        ad_html = self.fetch(VFR_AERODROMES_URL)
        heli_html = self.fetch(VFR_HELIPORTS_URL)

        # The first 3 folder-links on the aerodromes index are AD 0 Content,
        # AD 1 General Remarks, and the AD 2 list header — not airfields.
        aerodrome_links = self.folder_link_hrefs(ad_html)[3:]
        # The first heliport link is the HEL AD 3 list header, also not a field.
        heliport_links = self.folder_link_hrefs(heli_html)[1:]
        self.logger.info(
            f"VFR: {len(aerodrome_links)} aerodrome groups, "
            f"{len(heliport_links)} heliport groups"
        )

        for href in aerodrome_links:
            self._extract_vfr_group(
                urljoin(VFR_AERODROMES_URL, href), "vfr", airports
            )
        for href in heliport_links:
            self._extract_vfr_group(
                urljoin(VFR_HELIPORTS_URL, href), "heliport", airports
            )

    def _extract_vfr_group(
        self,
        url: str,
        category: Literal["vfr", "heliport"],
        airports: list[Airport],
    ) -> None:
        try:
            html = self.fetch(url)
        except Exception as e:
            self.logger.warning(f"Skipping VFR group {url}: {e}")
            return
        for el in self.soup(html).find_all("a", class_="folder-link"):
            href = el.get("href")
            if not href:
                continue
            title_span = el.find("span")
            title = (
                title_span.get_text(strip=True)
                if title_span is not None
                else el.get_text(strip=True)
            )
            if not title:
                continue
            match = _ICAO_TRAILING.search(title)
            icao = match.group(1) if match else None
            airports.append(
                Airport(
                    country=COUNTRY,
                    icao=icao,
                    title=title,
                    url=urljoin(url, href),
                    type=category,
                )
            )

    # ----- IFR ----------------------------------------------------------------

    def _process_ifr(self, airports: list[Airport]) -> None:
        ad2_html = self.fetch(IFR_AERODROMES_URL)
        ad3_html = self.fetch(IFR_HELIPORTS_URL)

        # dict.fromkeys preserves order while deduplicating (the original
        # code used set() which doesn't preserve insertion order).
        ad2_links = list(dict.fromkeys(self.folder_link_hrefs(ad2_html)))
        ad3_links = list(dict.fromkeys(self.folder_link_hrefs(ad3_html)))
        self.logger.info(
            f"IFR: {len(ad2_links)} aerodromes, {len(ad3_links)} heliports"
        )

        for href in ad2_links:
            self._extract_ifr_leaf(
                urljoin(IFR_AERODROMES_URL, href), "ifr", airports
            )
        for href in ad3_links:
            self._extract_ifr_leaf(
                urljoin(IFR_HELIPORTS_URL, href), "heliport", airports
            )

    def _extract_ifr_leaf(
        self,
        url: str,
        category: Literal["ifr", "heliport"],
        airports: list[Airport],
    ) -> None:
        try:
            html = self.fetch(url)
        except Exception as e:
            self.logger.warning(f"Skipping IFR leaf {url}: {e}")
            return
        soup = self.soup(html)
        city_el = soup.select_one("div.headlineText.left > span")
        city = city_el.get_text(strip=True) if city_el else ""
        icao = ""
        icao_el = soup.select_one("a.document-link > span.document-name")
        if icao_el:
            match = _ICAO_ANYWHERE.search(icao_el.get_text(strip=True))
            if match:
                icao = match.group(1)
        if not (city or icao):
            return
        airports.append(
            Airport(
                country=COUNTRY,
                icao=icao or None,
                title=f"{city} {icao}".strip(),
                url=url,
                type=category,
            )
        )

    # ----- entry point --------------------------------------------------------

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        try:
            self._process_vfr(airports)
            self.logger.info(f"VFR done: {len(airports)} airports so far.")
            ifr_start = len(airports)
            self._process_ifr(airports)
            self.logger.info(
                f"IFR done: {len(airports) - ifr_start} additional airports."
            )
            if not airports:
                raise ValueError(f"No {COUNTRY} airports found")
            self.logger.info(f"Found {len(airports)} airports for {COUNTRY}.")
            return airports
        finally:
            self.close()
