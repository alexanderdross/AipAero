import re
from typing import Literal
from urllib.parse import urljoin

from bs4 import Tag

from crawlers.http_base import Airport, HttpCrawlerBase

__all__ = ["HttpEurocontrolBase"]

AirportType = Literal["vfr", "ifr", "heliport", "mil", "aeroport"]

# Per-chapter title anchors look like "AD 2.LKPR PRAHA/Ruzyně" - the
# chapter prefix is stripped before the ICAO dedupe.
_CHAPTER_TITLE_PREFIX_RE = re.compile(r"^AD\s*[23]\.[A-Z]{4}\s*", re.I)


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

    def extract_airports_per_chapter(
        self,
        html: str,
        base_url: str,
        section_re: re.Pattern[str],
        category: AirportType,
        title_prefix_re: re.Pattern[str] | None = None,
    ) -> list[Airport]:
        """Parse per-aerodrome chapter sections (id like "AD-2.LPPTdetails").

        Some eAIPs (CZ, PT, HU, IS) have NO aggregate "AD 2" menu section:
        every aerodrome is its own top-level chapter. ``section_re`` runs
        against the section div's id and must capture the ICAO code as
        group 1. ``title_prefix_re`` (default: the "AD 2.XXXX" chapter
        prefix) is stripped from the title anchor's text.
        """
        if title_prefix_re is None:
            title_prefix_re = _CHAPTER_TITLE_PREFIX_RE
        self.logger.info(
            f"Extracting per-chapter airports from {base_url} "
            f"(section id ~ {section_re.pattern!r})"
        )
        soup = self.soup(html)
        airports: list[Airport] = []

        for details in soup.find_all("div", attrs={"id": section_re}):
            match = section_re.search(details["id"])
            if not match:  # pragma: no cover - find_all already matched
                continue
            icao = match.group(1)

            # Title lives in the sibling div right before the details div,
            # e.g. <a>AD 2.LKPR PRAHA/Ruzyně</a>.
            title = icao
            title_div = details.find_previous_sibling("div")
            if isinstance(title_div, Tag):
                anchors = title_div.find_all("a")
                if anchors:
                    raw = anchors[-1].get_text(" ", strip=True)
                    raw = re.sub(r"\s+", " ", raw).strip()
                    # Drop hidden annotation tokens (contain ";") and the
                    # chapter prefix, then de-duplicate a leading ICAO.
                    raw = " ".join(t for t in raw.split() if ";" not in t)
                    rest = title_prefix_re.sub("", raw).strip()
                    tokens = rest.split()
                    if tokens and tokens[0] == icao:
                        tokens = tokens[1:]
                    rest = " ".join(tokens).strip()
                    if rest:
                        title = f"{rest} {icao}"

            charts_url = self._find_charts_url(details, base_url)
            if charts_url is None:
                self.logger.warning(
                    f"{self.country}: no charts link for {icao}; skipping"
                )
                continue

            airports.append(
                Airport(
                    country=self.country,
                    icao=icao,
                    title=title,
                    url=charts_url,
                    type=category,
                )
            )

        if not airports:
            # Diagnostic: list the ids that DO exist so a failed live run
            # tells us the real chapter ids without needing the saved HTML.
            candidates = sorted(
                {
                    el["id"]
                    for el in soup.find_all(attrs={"id": True})
                    if "details" in el["id"].lower()
                }
            )[:60]
            raise ValueError(
                f"No per-chapter sections matching {section_re.pattern!r} "
                f"in {base_url}. Available *details ids: {candidates}"
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
        # eAIP menus embed hidden annotation tokens in the anchor text -
        # `TAD_HP;TXT_NAME;NNNN` (UK), `TCITY;CUSTOM_ATT7;175` (NO),
        # `TAD_HP;Annotation:113806.cze;2685` (CZ). No legitimate title
        # contains a semicolon, so drop every token that does.
        raw_title = " ".join(
            t for t in raw_title.split() if ";" not in t
        ).strip()
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
