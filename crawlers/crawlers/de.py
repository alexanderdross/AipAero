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

Each leaf page is served under a physical, edition-specific URL that is
renamed every AIRAC cycle (…/2026JUN25/chapter/<hash>.html). It also embeds
an amendment-stable permalink:

    <script>const myPermalink = "pages/CNNNNN.html";</script>

We store that permalink (resolved against the fork root) so saved links
survive the monthly edition rename.

Title and ICAO extraction differs per fork:
  - VFR leaves embed the title (with trailing 4-letter ICAO) in a span
    inside the `<a class="folder-link">` on the letter-group page.
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

# Fork roots (case-sensitive; DFS serves capital "Basic"). The static
# permalinks (`pages/CNNNNN.html`) are relative to these.
VFR_BASE = "https://aip.dfs.de/BasicVFR/"
IFR_BASE = "https://aip.dfs.de/BasicIFR/"

# Static section index pages (stable entry points):
VFR_AERODROMES_URL = VFR_BASE + "pages/C0004A.html"
VFR_HELIPORTS_URL = VFR_BASE + "pages/C00067.html"
IFR_AERODROMES_URL = IFR_BASE + "pages/C000C0.html"  # AD 2
IFR_HELIPORTS_URL = IFR_BASE + "pages/C01C60.html"  # AD 3

_ICAO_TRAILING = re.compile(r"([A-Z]{4})$")
_ICAO_ANYWHERE = re.compile(r"([A-Z]{4})")
# `const myPermalink = "pages/CNNNNN.html";` in each leaf page's <head>.
_PERMALINK_RE = re.compile(r"""myPermalink\s*=\s*['"]([^'"]+)['"]""")
# DFS now serves the static `pages/CNNNNN.html` entry pages as tiny
# `<meta http-equiv="Refresh" content="0; url=../<AIRAC>/chapter/<hash>.html">`
# stubs (0 anchors) instead of the content inline. httpx does not follow a
# meta refresh, so we extract and follow it ourselves.
_META_REFRESH_RE = re.compile(
    r"""http-equiv=["']?refresh["']?[^>]*content=["']?[^;]*;\s*url=([^"'>\s]+)""",
    re.I,
)


class DE(HttpCrawlerBase):
    """Germany crawler over DFS BasicVFR + BasicIFR.

    No browser: enters each fork at its static section index page (see the
    module docstring), walks the folder-link tree to the per-airfield leaves,
    and stores each field's amendment-stable `myPermalink` rather than the
    edition-specific physical URL DFS renames every AIRAC cycle.
    """

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

    def _permalink_from_html(self, html: str, base_url: str) -> str | None:
        """Return the absolute static permalink from a leaf page's HTML.

        Reads `const myPermalink = "pages/CNNNNN.html"` and resolves it
        against ``base_url`` (the fork root). Returns None if absent.
        """
        m = _PERMALINK_RE.search(html)
        return urljoin(base_url, m.group(1)) if m else None

    # ----- VFR ----------------------------------------------------------------

    def _fetch(self, url: str, _depth: int = 0) -> tuple[str, str]:
        """Fetch ``url``, transparently following `<meta refresh>` stubs.

        Returns ``(effective_url, html)`` - the effective URL is the final
        target after any redirects, so callers resolve the page's relative
        links against it (a stub at `pages/CNNNNN.html` refreshes to a
        `<AIRAC>/chapter/<hash>.html` in a different directory). Bounded depth
        guards against a refresh loop.
        """
        html = self.fetch(url)
        m = _META_REFRESH_RE.search(html)
        if m and _depth < 4:
            target = urljoin(url, m.group(1).replace("\\", "/"))
            self.logger.info(f"DE: following meta refresh {url} -> {target}")
            return self._fetch(target, _depth + 1)
        return url, html

    def _process_vfr(self, airports: list[Airport]) -> None:
        """Walk the BasicVFR aerodrome + heliport indexes into ``airports``.

        Each index lists letter-group folders; the group pages then list the
        individual fields (VFR is two levels deep, unlike the flat IFR lists).
        """
        ad_url, ad_html = self._fetch(VFR_AERODROMES_URL)
        heli_url, heli_html = self._fetch(VFR_HELIPORTS_URL)

        # The first 3 folder-links on the aerodromes index are AD 0 Content,
        # AD 1 General Remarks, and the AD 2 list header - not airfields.
        aerodrome_links = self.folder_link_hrefs(ad_html)[3:]
        # The first heliport link is the HEL AD 3 list header, also not a field.
        heliport_links = self.folder_link_hrefs(heli_html)[1:]
        self.logger.info(
            f"VFR: {len(aerodrome_links)} aerodrome groups, "
            f"{len(heliport_links)} heliport groups"
        )

        for href in aerodrome_links:
            self._extract_vfr_group(urljoin(ad_url, href), "vfr", airports)
        for href in heliport_links:
            self._extract_vfr_group(
                urljoin(heli_url, href), "heliport", airports
            )

    def _extract_vfr_group(
        self,
        url: str,
        category: Literal["vfr", "heliport"],
        airports: list[Airport],
    ) -> None:
        """Parse one VFR letter-group page into ``airports`` (fail-soft).

        A failed group fetch is logged and skipped so one bad letter does not
        empty the whole country. The field title (and its trailing ICAO) come
        from the span inside each `<a class="folder-link">`.
        """
        try:
            base_url, html = self._fetch(url)
        except Exception as e:
            self.logger.warning(f"Skipping VFR group {url}: {e}")
            return
        for el in self.soup(html).find_all("a", class_="folder-link"):
            href = el.get("href")
            if not href:
                continue
            # Title lives in the inner <span>; fall back to the link text.
            title_span = el.find("span")
            title = (
                title_span.get_text(strip=True)
                if title_span is not None
                else el.get_text(strip=True)
            )
            if not title:
                continue
            # ICAO is the trailing 4-letter code of the label (may be absent).
            match = _ICAO_TRAILING.search(title)
            icao = match.group(1) if match else None

            # If the folder-link href is already an amendment-stable permalink
            # (…/pages/CNNNNN.html), use it directly. Otherwise it is an
            # edition-specific URL (…/<AIRAC>/chapter/<hash>.html); fetch that
            # leaf (following its meta refresh) and read its `myPermalink` so
            # the stored link survives the next AIRAC amendment.
            leaf_url = urljoin(base_url, href)
            if "/pages/" in leaf_url:
                stable_url = leaf_url
            else:
                stable_url = leaf_url
                try:
                    _, leaf_html = self._fetch(leaf_url)
                    stable_url = (
                        self._permalink_from_html(leaf_html, VFR_BASE) or leaf_url
                    )
                except Exception as e:
                    self.logger.warning(
                        f"VFR permalink fetch failed for {leaf_url}: {e}"
                    )

            airports.append(
                Airport(
                    country=COUNTRY,
                    icao=icao,
                    title=title,
                    url=stable_url,
                    type=category,
                )
            )

    # ----- IFR ----------------------------------------------------------------

    def _process_ifr(self, airports: list[Airport]) -> None:
        """Walk the BasicIFR AD 2 (aerodromes) + AD 3 (heliports) lists.

        IFR lists are flat (one folder-link per field, no letter groups), so
        each href goes straight to a leaf page.
        """
        ad2_url, ad2_html = self._fetch(IFR_AERODROMES_URL)
        ad3_url, ad3_html = self._fetch(IFR_HELIPORTS_URL)

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
            self._extract_ifr_leaf(
                urljoin(ad3_url, href), "heliport", airports
            )

    def _extract_ifr_leaf(
        self,
        url: str,
        category: Literal["ifr", "heliport"],
        airports: list[Airport],
    ) -> None:
        """Parse one IFR leaf page into ``airports`` (fail-soft).

        Unlike VFR, IFR leaves split the name across two elements: the city in
        `div.headlineText.left > span` and the ICAO in
        `a.document-link > span.document-name`. The stored title recombines them
        ("City ICAO"); a leaf with neither is skipped.
        """
        try:
            _, html = self._fetch(url)
        except Exception as e:
            self.logger.warning(f"Skipping IFR leaf {url}: {e}")
            return
        soup = self.soup(html)
        # City/place name headline (left column of the leaf's title row).
        city_el = soup.select_one("div.headlineText.left > span")
        city = city_el.get_text(strip=True) if city_el else ""
        icao = ""
        # ICAO sits inside the document link's name span; take the first
        # 4-letter run anywhere in it.
        icao_el = soup.select_one("a.document-link > span.document-name")
        if icao_el:
            match = _ICAO_ANYWHERE.search(icao_el.get_text(strip=True))
            if match:
                icao = match.group(1)
        if not (city or icao):
            return
        # The leaf HTML is already in hand - read its stable permalink for free.
        stable_url = self._permalink_from_html(html, IFR_BASE) or url
        airports.append(
            Airport(
                country=COUNTRY,
                icao=icao or None,
                title=f"{city} {icao}".strip(),
                url=stable_url,
                type=category,
            )
        )

    # ----- entry point --------------------------------------------------------

    def crawl(self) -> list[Airport]:
        """Crawl both DFS forks (VFR then IFR) into one Airport list.

        Raises if the combined result is empty (a structural break worth
        failing on); the drop guard in OutputHandler catches partial losses.
        """
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
