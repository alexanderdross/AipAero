"""Belgium & Luxembourg (skeyes) eAIP crawler.

Source: skeyes (Belgocontrol) serves a standard eurocontrol frameset eAIP at
`ops.skeyes.be`. Unlike the founding-five eAIPs, its menu has NO aggregate
"AD 2" category node - every aerodrome/heliport is its own chapter. So this
crawler discovers airports by scanning the navigation HTML for per-airport
"AD-2.<ICAO>details" / "AD-3.<ICAO>details" ids (see `_AIRPORT_SECTION_RE`)
rather than expanding a category section, and derives the VFR/IFR/mil/heliport
type from the nearest preceding category heading in document order.
"""

import re

from bs4 import Tag

from crawlers.http_base import Airport, current_airac_date
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "BE"
ROOT_URL = (
    "https://ops.skeyes.be/html/belgocontrol_static/eaip/eAIP_Main/html/"
    "index-en-GB.html"
)

# Like the CZ eAIP, the skeyes menu has NO aggregate category sections:
# every aerodrome/heliport is its own chapter with an id like
# "AD-2.EBAWdetails" / "AD-3.<ICAO>details" (verified via the live-crawl
# test diagnostics: 40+ per-airport ids; none of the "AD 2 PUBLIC
# AERODROMES"-style category ids from the task spec exist as menu nodes).
_AIRPORT_SECTION_RE = re.compile(r"AD-([23])\.([A-Z]{4})details$")
# Title anchors look like "AD 2.EBAW ANTWERPEN / Deurne" - strip the prefix.
_TITLE_PREFIX_RE = re.compile(r"^AD\s*[23]\.[A-Z]{4}\s*", re.I)

# Task-spec category -> type mapping (crawler_belgium_luxembourg.md). The
# category is not part of the per-airport id, so it is resolved from the
# nearest PRECEDING category heading in the menu (document order).
_CATEGORY_TYPES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"PUBLIC\s+AERODROMES", re.I), "ifr"),
    (re.compile(r"MILITARY\s+AERODROMES", re.I), "mil"),
    (re.compile(r"(PRIVATE|ULM|PERSONAL)\s+AERODROMES", re.I), "vfr"),
    (re.compile(r"HELIPORTS", re.I), "heliport"),
]
_CATEGORY_ANY_RE = re.compile(
    r"(PUBLIC|MILITARY|PRIVATE|ULM|PERSONAL)\s+AERODROMES|"
    r"(MILITARY|HOSPITAL|PRIVATE|PERSONAL)\s+HELIPORTS",
    re.I,
)


class BE(HttpEurocontrolBase):
    """Belgium & Luxembourg AIP crawler.

    skeyes serves the standard eurocontrol frameset eAIP; `index-en-GB.html`
    IS the top frameset (frames eAISCommands / eAISNavigation / eAISContent,
    verified via the live-crawl diagnostics), so a single hop reaches the
    menu. Each aerodrome/heliport is its own chapter ("AD-2.<ICAO>details" /
    "AD-3.<ICAO>details"); the spec's category -> type mapping is applied by
    looking at the nearest preceding category heading, with an AD-part based
    fallback (AD-2 -> vfr, AD-3 -> heliport).
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)
        # The source 403s the polite crawler UA (verified live) - send a
        # plain browser fingerprint.
        self.use_browser_headers()

    def _category_for(self, details: Tag, ad_part: str) -> str:
        """Resolve the airport type from the nearest preceding category label.

        The per-airport id carries no category, so walk BACKWARDS in document
        order from this airport's details div to the closest category heading
        ("... PUBLIC AERODROMES", "... HELIPORTS", ...) and map it to a type.
        """
        # Nearest category heading text that precedes this airport in the menu.
        label = details.find_previous(string=_CATEGORY_ANY_RE)
        if label:
            text = str(label)
            for rx, airport_type in _CATEGORY_TYPES:
                if rx.search(text):
                    return airport_type
        # No category heading found - fall back by AD part.
        return "heliport" if ad_part == "3" else "vfr"

    def _extract_airport_sections(
        self, nav_html: str, nav_url: str
    ) -> list[Airport]:
        """Scan the menu HTML for per-airport chapters and build Airports.

        Each aerodrome/heliport is a `<div id="AD-2.<ICAO>details">` (or AD-3).
        For each match derive the ICAO + AD part from the id, read a human
        title from the preceding sibling anchor, resolve the type from the
        surrounding category heading, and locate the chart-list URL.
        """
        soup = self.soup(nav_html)
        airports: list[Airport] = []

        # Every airport is its own chapter div - iterate the id matches.
        for details in soup.find_all("div", attrs={"id": _AIRPORT_SECTION_RE}):
            match = _AIRPORT_SECTION_RE.search(details["id"])
            if not match:  # pragma: no cover - find_all already matched
                continue
            ad_part, icao = match.group(1), match.group(2)

            # Title lives in the sibling div right before the details div;
            # default to the bare ICAO if we cannot parse a clean name.
            title = icao
            title_div = details.find_previous_sibling("div")
            if isinstance(title_div, Tag):
                anchors = title_div.find_all("a")
                if anchors:
                    # Last anchor holds the full "AD 2.EBAW ANTWERPEN ..." label.
                    raw = anchors[-1].get_text(" ", strip=True)
                    raw = re.sub(r"\s+", " ", raw).strip()
                    # Drop hidden annotation tokens (contain ";"), the
                    # chapter prefix, and a duplicated leading ICAO.
                    raw = " ".join(t for t in raw.split() if ";" not in t)
                    # Strip the "AD 2.EBAW " chapter prefix from the label.
                    rest = _TITLE_PREFIX_RE.sub("", raw).strip()
                    tokens = rest.split()
                    # Some labels repeat the ICAO right after the prefix - drop it.
                    if tokens and tokens[0] == icao:
                        tokens = tokens[1:]
                    rest = " ".join(tokens).strip()
                    # Canonical form: "<place name> <ICAO>".
                    if rest:
                        title = f"{rest} {icao}"

            # Follow this chapter to its chart-list page; skip if none exists.
            charts_url = self._find_charts_url(details, nav_url)
            if charts_url is None:
                self.logger.warning(f"BE: no charts link for {icao}; skipping")
                continue

            airports.append(
                Airport(
                    country=self.country,
                    icao=icao,
                    title=title,
                    url=charts_url,
                    type=self._category_for(details, ad_part),
                )
            )

        # Empty result almost always means the menu markup changed - fail loud
        # so the drop guard / diagnostics fire rather than publishing nothing.
        if not airports:
            raise ValueError(f"No per-airport AD sections found in {nav_url}")
        return airports

    # Chart-PDF extraction: skeyes blocks plain clients (403) but this
    # crawler's browser headers get through; "-2-1" mirrors the eurocontrol
    # chart numbering (aerodrome chart). Validated via the live test.
    FETCH_PDF_URLS = True
    PDF_TEXT_PRIORITY = (r"-2-1$",)

    def crawl(self) -> list[Airport]:
        """Fetch the eAIP menu and return every aerodrome/heliport.

        `last_url` / `last_html` track the most recently fetched page so a
        failure anywhere in the chain can dump that page for post-mortem.
        """
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # Prefetch the index so a frame-chain failure still leaves the
            # page in `last_html` for the diagnostics/artifact below.
            index_html = self.fetch(ROOT_URL)
            last_url, last_html = ROOT_URL, index_html
            # skeyes URLs carry no edition date; stamp the on-cycle AIRAC.
            self.airac = current_airac_date()

            # index-en-GB.html IS the top frameset - one hop to the menu.
            nav_url, nav_html = self.follow_frame_chain(
                ROOT_URL, ["eAISNavigation"]
            )
            last_url, last_html = nav_url, nav_html

            airports.extend(self._extract_airport_sections(nav_html, nav_url))

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"BE crawl failed: {e}")
            if last_html is not None:
                self.log_candidate_links(last_html, last_url, limit=40)
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
