"""Denmark AIP crawler.

Source: Naviair AIM (https://aim.naviair.dk/). Unlike NL/UK/FR this is a
custom, **client-rendered JS** navigation UI - a plain HTTP fetch returns a
near-empty shell with no links (verified via the live-crawl test). It
therefore inherits :class:`PlaywrightCrawlerBase` and renders each page in a
headless browser before walking the menu by link text; the BeautifulSoup
extraction below runs on the rendered DOM.

Navigation path (per the task spec in
``crawlers/tasks/crawler_denmark.md``):

    aim.naviair.dk
        └─ chapter "02. VFR Flight Guide Danmark"
            └─ "VFG Part 3 - FLYVEPLADSER (AD)"
                ├─ "AD 2 - PUBLIC AERODROMES"  → type "vfr"
                └─ "AD 3 - HELIPORTS"          → type "heliport"

For each airfield:
  - title: the listed label with the ICAO moved to the end and the " - "
    separator dropped, e.g. "Anholt - EKAT" → "Anholt EKAT".
  - icao:  the trailing 4-letter code (e.g. "EKAT"); may be None.
  - url:   the ADC (Aerodrome Chart) link — the href whose target contains
    "ADC", e.g. ``EK_AD_2_EKEB_ADC_en.pdf``.

IMPORTANT — the exact rendered DOM of aim.naviair.dk is **unverified**: the
host is unreachable from the build/CI environment, so the structure encoded
below is the best-effort interpretation of the task spec and has NOT been
validated against live HTML. The parser is therefore written defensively and
fails soft: every navigation/parse step is wrapped so a layout mismatch (or a
missing browser) logs a warning and returns whatever airports were
recoverable rather than raising. The live-crawl test reveals the real
rendered structure and we iterate from there.
"""

from __future__ import annotations

import re
from urllib.parse import urljoin

from bs4 import Tag

from crawlers.http_base import Airport
from crawlers.playwright_base import PlaywrightCrawlerBase, PlaywrightUnavailable

COUNTRY = "DK"
ROOT_URL = "https://aim.naviair.dk/"

# Trailing 4-letter ICAO in a label ("Anholt - EKAT" → "EKAT"). Danish codes
# start with "EK" but we keep the match generic to 4 uppercase letters.
_ICAO_TRAILING = re.compile(r"([A-Z]{4})\s*$")
# ICAO embedded in an ADC filename (…_EKEB_ADC_en.pdf → "EKEB").
_ICAO_IN_HREF = re.compile(r"([A-Z]{4})[_-]?ADC", re.I)


class DK(PlaywrightCrawlerBase):
    def __init__(self) -> None:
        super().__init__(COUNTRY)

    # ----- navigation helpers -------------------------------------------------

    def _find_link_by_text(
        self, html: str, base_url: str, *needles: str
    ) -> str | None:
        """Return the absolute href of the first `<a>` whose visible text
        contains any of ``needles`` (case-insensitive), or None."""
        soup = self.soup(html)
        wanted = [n.lower() for n in needles]
        for a in soup.find_all("a", href=True):
            text = self.clean_text(a.get_text()).lower()
            if any(n in text for n in wanted):
                return urljoin(base_url, a["href"])
        return None

    def _follow(
        self, html: str, base_url: str, *needles: str
    ) -> tuple[str, str] | None:
        """Find a link by text (see :meth:`_find_link_by_text`), render it,
        and return (url, html). Returns None (logging a warning) if the link
        is missing or the render fails — the caller decides how to proceed."""
        url = self._find_link_by_text(html, base_url, *needles)
        if url is None:
            self.logger.warning(
                f"DK: no nav link matching {needles!r} under {base_url}"
            )
            # Diagnostic for the live-crawl test: show what links the RENDERED
            # page exposes (an empty list means even the browser found none -
            # the tree is likely built via non-anchor click handlers).
            self.log_candidate_links(
                html, base_url, limit=40, contains=r"aip|vfg|vfr|dokument|doc"
            )
            return None
        try:
            return url, self.render_html(url)
        except Exception as e:
            self.logger.warning(f"DK: failed to render nav link {url}: {e}")
            return None

    # ----- extraction ---------------------------------------------------------

    @staticmethod
    def _adc_href(container: Tag) -> str | None:
        """First href in ``container`` that points at an ADC chart."""
        for a in container.find_all("a", href=True):
            href = a["href"]
            title = a.get("title", "") or ""
            if "ADC" in href.upper() or "ADC" in title.upper():
                return href
        return None

    def _title_and_icao(self, label: str) -> tuple[str, str | None]:
        """Normalise a listed label into (title, icao).

        "Anholt - EKAT" → ("Anholt EKAT", "EKAT"). The " - " separator is
        dropped and the ICAO kept at the end. ICAO may be None.
        """
        label = self.clean_text(label)
        # Drop the "-" separator between name and ICAO ("Anholt - EKAT").
        normalised = re.sub(r"\s*-\s*", " ", label).strip()
        match = _ICAO_TRAILING.search(normalised)
        icao = match.group(1) if match else None
        return normalised, icao

    def _extract_section(
        self, html: str, base_url: str, category: str
    ) -> list[Airport]:
        """Best-effort parse of an AD-section listing into airports.

        The DOM is unverified, so we anchor on the one signal the spec is
        explicit about: the ADC chart link. For every anchor whose target is
        an ADC chart we walk up to the nearest container that also carries a
        human-readable label, derive title + ICAO from that label (falling
        back to the ICAO embedded in the ADC filename), and emit one Airport.
        Anything that doesn't fit is skipped with a debug log — never raised.
        """
        airports: list[Airport] = []
        seen_urls: set[str] = set()
        soup = self.soup(html)

        for a in soup.find_all("a", href=True):
            href = a["href"]
            title_attr = a.get("title", "") or ""
            if "ADC" not in href.upper() and "ADC" not in title_attr.upper():
                continue

            chart_url = urljoin(base_url, href)
            if chart_url in seen_urls:
                continue

            # Find a label: climb ancestors until one yields a "…- ICAO" text.
            label = ""
            node: Tag | None = a
            for _ in range(5):
                node = node.parent if isinstance(node, Tag) else None
                if node is None:
                    break
                candidate = self.clean_text(node.get_text(separator=" "))
                if _ICAO_TRAILING.search(re.sub(r"\s*-\s*", " ", candidate)):
                    label = candidate
                    break

            title, icao = self._title_and_icao(label) if label else ("", None)

            if icao is None:
                href_match = _ICAO_IN_HREF.search(href)
                if href_match:
                    icao = href_match.group(1).upper()
                    if not title:
                        title = icao

            if not title:
                self.logger.debug(f"DK: skipping ADC link without label: {href}")
                continue

            seen_urls.add(chart_url)
            airports.append(
                Airport(
                    country=COUNTRY,
                    icao=icao,
                    title=title,
                    url=chart_url,
                    type=category,
                )
            )

        self.logger.info(
            f"DK: extracted {len(airports)} '{category}' airports from {base_url}"
        )
        return airports

    # ----- entry point --------------------------------------------------------

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # Render the shell so the JS-built navigation tree is present.
            root_html = self.render_html(ROOT_URL)
            last_url, last_html = ROOT_URL, root_html

            # chapter "02. VFR Flight Guide Danmark"
            step = self._follow(root_html, ROOT_URL, "VFR Flight Guide")
            if step is None:
                return airports
            last_url, last_html = step

            # "VFG Part 3 - FLYVEPLADSER (AD)"
            step = self._follow(last_html, last_url, "Part 3", "FLYVEPLADSER")
            if step is None:
                return airports
            part3_url, part3_html = step
            last_url, last_html = part3_url, part3_html

            # AD 2 - PUBLIC AERODROMES → vfr
            step = self._follow(part3_html, part3_url, "AD 2", "PUBLIC AERODROMES")
            if step is not None:
                ad2_url, ad2_html = step
                airports.extend(self._extract_section(ad2_html, ad2_url, "vfr"))

            # AD 3 - HELIPORTS → heliport
            step = self._follow(part3_html, part3_url, "AD 3", "HELIPORTS")
            if step is not None:
                ad3_url, ad3_html = step
                airports.extend(
                    self._extract_section(ad3_html, ad3_url, "heliport")
                )
        except PlaywrightUnavailable as e:
            # No browser on this host - DK stays unavailable, but the run must
            # not crash (the other countries still publish).
            self.logger.error(
                f"DK skipped - headless browser unavailable: {e}"
            )
        except Exception as e:
            self.logger.error(f"DK crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
