import re
from typing import Literal
from urllib.parse import urljoin

from bs4 import Tag

from crawlers.http_base import Airport, HttpCrawlerBase

__all__ = ["HttpEurocontrolBase"]

AirportType = Literal["vfr", "ifr", "heliport", "mil", "aeroport"]


class HttpEurocontrolBase(HttpCrawlerBase):
    """Shared parser for the eurocontrol "eAIP" navigation HTML.

    The navigation page is a single static document that lists every
    aerodrome / heliport under a tree of `<div>`s. Each entry is two
    sibling `<div>`s: the first holds the title (with the ICAO code), the
    second holds the per-airport links — including the "Charts related to
    an aerodrome" link we want.
    """

    def extract_airports_from_html(
        self,
        html: str,
        base_url: str,
        id_in_menu: str,
        category: AirportType,
    ) -> list[Airport]:
        """Parse one menu section (e.g. "AD-2-IFRdetails") into airports."""
        self.logger.info(
            f"Extracting airports from {base_url} (section id$={id_in_menu!r})"
        )
        soup = self.soup(html)

        # Match any element whose id ends with `id_in_menu`. We do this
        # with a substring check rather than a CSS attribute selector
        # because some country eAIPs put spaces and locale codes in the id.
        menu_div: Tag | None = None
        for el in soup.find_all(attrs={"id": True}):
            if el["id"].endswith(id_in_menu):
                menu_div = el
                break
        if menu_div is None:
            # Diagnostic: list the ids that DO exist so a failed live run
            # tells us the real section id without needing the saved HTML.
            candidates = sorted(
                {
                    el["id"]
                    for el in soup.find_all(attrs={"id": True})
                    if "details" in el["id"].lower()
                }
            )[:40]
            raise ValueError(
                f"Menu div ending with {id_in_menu!r} not found in {base_url}. "
                f"Available *details ids: {candidates}"
            )

        # Direct child <div>s only — same as the original `> div` selector.
        menu_items = [c for c in menu_div.find_all("div", recursive=False)]
        paired = list(zip(menu_items[::2], menu_items[1::2]))
        self.logger.debug(
            f"Section {id_in_menu!r}: {len(menu_items)} items, "
            f"{len(paired)} pairs"
        )

        airports: list[Airport] = []
        for title_div, details_div in paired:
            airport = self._parse_pair(title_div, details_div, base_url, category)
            if airport is not None:
                airports.append(airport)

        if not airports:
            raise ValueError(
                f"No airports found for section {id_in_menu!r} in {base_url}"
            )
        return airports

    def _parse_pair(
        self,
        title_div: Tag,
        details_div: Tag,
        base_url: str,
        category: AirportType,
    ) -> Airport | None:
        anchors = title_div.find_all("a")
        if not anchors:
            return None

        # Title: take the last <a>'s visible text (mirrors the Selenium
        # `innerText` behaviour closely enough for this content — these
        # pages have no display:none nodes inside the title link).
        raw_title = anchors[-1].get_text(separator=" ", strip=True)
        raw_title = raw_title.replace("—", "")
        raw_title = re.sub(r"\s+", " ", raw_title).strip()
        # UK eAIP appends `TAD_HP;TXT_NAME;NNNN` to some titles.
        raw_title = raw_title.split("TAD_HP")[0].strip()
        if not raw_title:
            return None

        parts = raw_title.split(" ")
        icao_candidate = parts[0].upper()
        if re.fullmatch(r"[A-Z]{4}", icao_candidate):
            icao: str | None = icao_candidate
            title_rest = " ".join(parts[1:]).strip()
        else:
            # No ICAO location indicator (some small aerodromes / heliports
            # are listed by name only). Keep the whole label as the title
            # rather than emitting a bogus, non-ICAO "code".
            icao = None
            title_rest = raw_title

        charts_url = self._find_charts_url(details_div, base_url)
        if charts_url is None:
            return None

        title = f"{title_rest} {icao}".strip() if icao else title_rest
        return Airport(
            country=self.country,
            icao=icao,
            title=title,
            url=charts_url,
            type=category,
        )

    @staticmethod
    def _find_charts_url(details_div: Tag, base_url: str) -> str | None:
        # Prefer the explicitly-tagged "Charts related to an aerodrome" link.
        for a in details_div.select("div a[title]"):
            title_attr = a.get("title", "")
            if "charts related" in title_attr.lower():
                href = a.get("href")
                if href:
                    return urljoin(base_url, href)

        # Fallback: last `<a>` directly under one of the inner <div>s.
        candidates = details_div.select("div > a[href]")
        if candidates:
            href = candidates[-1].get("href")
            if href:
                return urljoin(base_url, href)

        return None
