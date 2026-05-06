"""Germany AIP crawler.

DFS publishes two parallel sites: BasicVFR (https://aip.dfs.de/BasicVFR/)
and BasicIFR (https://aip.dfs.de/BasicIFR/). Each is a folder-link tree:

    BasicVFR/  →  AD Aerodromes        → letter-grouped pages → leaf pages
                  HEL AD Helicopter…   → letter-grouped pages → leaf pages
    BasicIFR/  →  AD Aerodromes        → AD 2 / AD 3 indexes → leaf pages

Some early-stage redirects on the DFS site have been server-side, others
HTML meta-refresh — we follow either kind via `fetch_with_meta_refresh`.

Title and ICAO extraction differs per fork:
  - VFR leaves embed the title (with trailing 4-letter ICAO) in a span
    inside the `<a class="folder-link">`.
  - IFR leaves carry the city in `div.headlineText.left > span` and the
    ICAO in `a.document-link > span.document-name`.
"""

from __future__ import annotations

import re
from typing import Literal
from urllib.parse import urljoin

from bs4 import Tag

from crawlers.http_base import Airport, HttpCrawlerBase

COUNTRY = "DE"
ROOT_VFR_URL = "https://aip.dfs.de/BasicVFR/"
ROOT_IFR_URL = "https://aip.dfs.de/BasicIFR/"

_ICAO_TRAILING = re.compile(r"([A-Z]{4})$")
_ICAO_ANYWHERE = re.compile(r"([A-Z]{4})")
_META_REFRESH_URL = re.compile(r"url=([^;]+)", re.IGNORECASE)


class DE(HttpCrawlerBase):
    def __init__(self) -> None:
        super().__init__(COUNTRY)

    # ----- helpers ------------------------------------------------------------

    def fetch_with_meta_refresh(
        self, url: str, *, max_hops: int = 5
    ) -> tuple[str, str]:
        """Fetch `url`, then follow any `<meta http-equiv="refresh">` chain.

        httpx already follows HTTP 30x redirects automatically; this covers
        the legacy meta-refresh path that some DFS landing pages use.
        Returns ``(final_url, final_html)``.
        """
        for _ in range(max_hops):
            html = self.fetch(url)
            soup = self.soup(html)
            meta = soup.find(
                "meta",
                attrs={
                    "http-equiv": lambda v: bool(v) and v.lower() == "refresh"
                },
            )
            if not isinstance(meta, Tag):
                return url, html
            content = meta.get("content", "") or ""
            match = _META_REFRESH_URL.search(content)
            if not match:
                return url, html
            next_url = urljoin(url, match.group(1).strip().strip("'\""))
            if next_url == url:
                return url, html  # avoid loops
            self.logger.info(f"meta-refresh: {url} -> {next_url}")
            url = next_url
        return url, html

    def find_link_by_text(
        self, html: str, base_url: str, text_substring: str
    ) -> str:
        """Return absolute URL of the first `<a>` whose text contains the substring."""
        for a in self.soup(html).find_all("a", href=True):
            if text_substring in a.get_text():
                return urljoin(base_url, a["href"])
        raise ValueError(
            f"Link containing {text_substring!r} not found in {base_url}"
        )

    def folder_link_hrefs(self, html: str) -> list[str]:
        """All hrefs from `<a class="folder-link">` elements, in document order."""
        return [
            a["href"]
            for a in self.soup(html).find_all("a", class_="folder-link")
            if a.get("href")
        ]

    # ----- VFR ----------------------------------------------------------------

    def _process_vfr(self, airports: list[Airport]) -> None:
        root_url, root_html = self.fetch_with_meta_refresh(ROOT_VFR_URL)
        ad_url = self.find_link_by_text(root_html, root_url, "AD Aerodromes")
        ad_html = self.fetch(ad_url)
        heli_url = self.find_link_by_text(
            root_html, root_url, "HEL AD Helicopter Aerodromes"
        )
        heli_html = self.fetch(heli_url)

        # The first 3 folder-links on the aerodromes page are AD 0 Content,
        # AD 1 General Remarks, and AD 2 list of Aerodromes — not airfields.
        aerodrome_links = self.folder_link_hrefs(ad_html)[3:]
        # The first heliport link is the HEL AD 3 list, also not an airfield.
        heliport_links = self.folder_link_hrefs(heli_html)[1:]
        self.logger.info(
            f"VFR: {len(aerodrome_links)} aerodrome groups, "
            f"{len(heliport_links)} heliport groups"
        )

        for href in aerodrome_links:
            self._extract_vfr_group(urljoin(ad_url, href), "vfr", airports)
        for href in heliport_links:
            self._extract_vfr_group(urljoin(heli_url, href), "heliport", airports)

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
        root_url, root_html = self.fetch_with_meta_refresh(ROOT_IFR_URL)
        ad_url = self.find_link_by_text(root_html, root_url, "AD Aerodromes")
        ad_html = self.fetch(ad_url)
        ad2_url = self.find_link_by_text(ad_html, ad_url, "AD 2 Aerodromes")
        ad3_url = self.find_link_by_text(ad_html, ad_url, "AD 3 Heliports")
        ad2_html = self.fetch(ad2_url)
        ad3_html = self.fetch(ad3_url)

        # dict.fromkeys preserves order while deduplicating (the original
        # code used set() which doesn't preserve insertion order).
        ad2_links = list(dict.fromkeys(self.folder_link_hrefs(ad2_html)))
        ad3_links = list(dict.fromkeys(self.folder_link_hrefs(ad3_html)))
        self.logger.info(
            f"IFR: {len(ad2_links)} aerodromes, {len(ad3_links)} heliports"
        )

        for href in ad2_links:
            self._extract_ifr_leaf(urljoin(ad2_url, href), "ifr", airports)
        for href in ad3_links:
            self._extract_ifr_leaf(urljoin(ad3_url, href), "heliport", airports)

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
            self.logger.info(
                f"VFR done: {len(airports)} airports so far."
            )
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
