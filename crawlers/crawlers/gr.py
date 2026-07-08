import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "GR"
ROOT_URL = "https://aisgr.hasp.gov.gr/"

# The HASP portal fronts the effective AIP behind an intro page: a "Browse"
# link into the currently effective AIP, then an "AIP" button (aircraft icon),
# then the "AIP GREECE | Aeronautical Information Publication" entry, which
# finally opens the eurocontrol-style eAIP frameset. We follow those hops by
# matching link text before walking the frame chain. Because the live source
# is captcha-gated, these selectors are UNVERIFIED (see class docstring).
_BROWSE_RE = re.compile(r"browse", re.I)
_AIP_ENTRY_RE = re.compile(r"\bAIP\b.*GREECE|Aeronautical Information Publication", re.I)
_INDEX_HREF_RE = re.compile(r"index(?:[-_][A-Za-z]{2}-[A-Za-z]{2})?\.html$", re.I)


class GR(HttpEurocontrolBase):
    """Greece AIP crawler (Hellenic AIS — https://aisgr.hasp.gov.gr/).

    The Hellenic AIS portal serves a EUROCONTROL-style eAIP frameset. The
    navigation lists aerodromes and heliports under the Part 3 (AD) tree:

        Part 3 AERODROMES (AD)
            AD 2 AERODROMES   -> mapped to type "vfr"
            AD 3 HELIPORTS    -> mapped to type "heliport"

    Each airport's chosen URL is the "Charts related to the aerodrome" link
    (e.g. `AD 2.24 LGAV CHARTS RELATED TO THE AERODROME`), which
    `HttpEurocontrolBase._find_charts_url` already prefers by matching the
    "charts related" link title. Titles arrive as `LGAV ATHINAI/Eleftherios
    Venizelos`; the base parser moves the leading 4-letter ICAO code to the
    end (`ATHINAI/Eleftherios Venizelos LGAV`) and leaves `icao` None when no
    ICAO indicator is present.

    CAVEAT — UNVERIFIED / captcha-gated. The public entry
    (https://aisgr.hasp.gov.gr/) is protected by a captcha, so this crawl path
    could not be run or verified here. Running it in production will likely
    require solving the captcha and/or routing through the web proxy the
    maintainer provides. Consequently the intermediate link selectors
    (`Browse` / `AIP` / `AIP GREECE`) and the AD-section id suffixes below
    ("AD 2en-GBdetails" / "AD 3en-GBdetails", mirrored from the NL eAIP) are
    best-effort and must be confirmed against the live navigation HTML.
    No network work happens at import or in ``__init__``.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _find_link(self, html: str, base_url: str, pattern: re.Pattern) -> str | None:
        """Return the first absolute href whose link text matches ``pattern``."""
        soup = self.soup(html)
        for a in soup.find_all("a", href=True):
            text = a.get_text(separator=" ", strip=True)
            if pattern.search(text) or pattern.search(a.get("title", "")):
                return urljoin(base_url, a["href"].replace("\\", "/"))
        return None

    def _resolve_eaip_index(self, base_url: str, html: str) -> str:
        """Walk the HASP intro hops to the eAIP frameset index.

        Best-effort: follow the "Browse" link into the effective AIP, then the
        "AIP GREECE | Aeronautical Information Publication" entry, falling back
        to any `index*.html` link if the labelled hops are not present.
        """
        current_url, current_html = base_url, html

        browse = self._find_link(current_html, current_url, _BROWSE_RE)
        if browse:
            current_url = browse
            current_html = self.fetch(browse)

        entry = self._find_link(current_html, current_url, _AIP_ENTRY_RE)
        if entry:
            return entry

        soup = self.soup(current_html)
        for a in soup.find_all("a", href=True):
            href = a["href"].replace("\\", "/")
            if _INDEX_HREF_RE.search(href.split("?")[0].split("#")[0]):
                return urljoin(current_url, href)

        raise ValueError(f"Could not resolve eAIP index from {base_url}")

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. Enter the portal and resolve the effective eAIP frameset index.
            root_html = self.fetch(ROOT_URL)
            last_url, last_html = ROOT_URL, root_html

            index_url = self._resolve_eaip_index(ROOT_URL, root_html)

            # 2. Walk the frame chain to the navigation HTML.
            nav_url, nav_html = self.follow_frame_chain(
                index_url, ["eAISNavigationBase", "eAISNavigation"]
            )
            last_url, last_html = nav_url, nav_html

            # 3. Extract aerodromes (AD 2 -> vfr) and heliports (AD 3 -> heliport).
            airports.extend(
                self.extract_airports_from_html(
                    nav_html, nav_url, "AD 2en-GBdetails", "vfr"
                )
            )
            airports.extend(
                self.extract_airports_from_html(
                    nav_html, nav_url, "AD 3en-GBdetails", "heliport"
                )
            )
        except Exception as e:
            self.logger.error(f"GR crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
