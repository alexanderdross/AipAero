import re

from bs4 import Tag

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "CZ"
ROOT_URL = "https://aim.rlp.cz/eaip/html/index-en-GB.html"

# The CZ eAIP menu has NO aggregate "AD 2" section: every aerodrome is its own
# top-level chapter with an id like "AD-2.LKPRdetails" (verified via the
# live-crawl test diagnostics). We therefore iterate the per-airport sections
# directly instead of using the aggregate-section parser.
_AIRPORT_SECTION_RE = re.compile(r"AD-2\.([A-Z]{4})details$")
# Title anchors look like "AD 2.LKPR PRAHA/Ruzyně" - strip the chapter prefix.
_TITLE_PREFIX_RE = re.compile(r"^AD\s*2\.[A-Z]{4}\s*", re.I)


class CZ(HttpEurocontrolBase):
    """Czechia (Česko) AIP crawler.

    ANS CR / RLP serves the standard eurocontrol frameset eAIP at
    `aim.rlp.cz`. ``index-en-GB.html`` is the frameset entry point itself
    (no separate edition-picker landing page), so we walk the frame chain
    straight to the navigation HTML.

    Unlike NL/UK/FR, the CZ menu lists each aerodrome as its own chapter
    ("AD 2.LKPR PRAHA/Ruzyně" with section id ``AD-2.LKPRdetails``), so the
    airports are extracted per-section. Per the CZ task spec
    (crawlers/tasks/crawler_czech.md) every aerodrome is emitted as type
    "ifr" and the URL is the "Charts related to the aerodrome" link.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _extract_airport_sections(
        self, nav_html: str, nav_url: str
    ) -> list[Airport]:
        """Emit one IFR Airport per aerodrome chapter in the CZ nav menu.

        The CZ eAIP has no aggregate AD 2 list, so instead of the base's
        aggregate-section parser we scan every per-aerodrome details div
        (``id="AD-2.<ICAO>details"``): the id yields the ICAO, the sibling
        title div gives the display name, and the "Charts related to the
        aerodrome" link becomes the airport URL. Raises ValueError when no
        such sections are found (markup drift / wrong nav page) so the crawl
        fails loud rather than silently publishing an empty country.
        """
        soup = self.soup(nav_html)
        airports: list[Airport] = []

        # Each aerodrome is its own chapter; the regex-matched id both selects
        # the section and carries the ICAO in its capture group.
        for details in soup.find_all(
            "div", attrs={"id": _AIRPORT_SECTION_RE}
        ):
            match = _AIRPORT_SECTION_RE.search(details["id"])
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
                    rest = _TITLE_PREFIX_RE.sub("", raw).strip()
                    tokens = rest.split()
                    if tokens and tokens[0] == icao:
                        tokens = tokens[1:]
                    rest = " ".join(tokens).strip()
                    if rest:
                        title = f"{rest} {icao}"

            # The AIP page URL is the aerodrome's "Charts related to the
            # aerodrome" link (per the CZ task spec); skip the field if the
            # menu row has none to point at.
            charts_url = self._find_charts_url(details, nav_url)
            if charts_url is None:
                self.logger.warning(
                    f"CZ: no charts link for {icao}; skipping"
                )
                continue

            airports.append(
                Airport(
                    country=self.country,
                    icao=icao,
                    title=title,
                    url=charts_url,
                    type="ifr",
                )
            )

        if not airports:
            raise ValueError(
                f"No per-airport AD-2 sections found in {nav_url}"
            )
        return airports

    # Chart-PDF extraction (recon 2026-07-12): semantic hrefs like
    # a2-tb-vfrc.pdf (VFR chart) / a2-tb-adc.pdf (aerodrome chart).
    FETCH_PDF_URLS = True
    PDF_HREF_PRIORITY = (r"-vfrc\.pdf$", r"-adc\.pdf$")

    def crawl(self) -> list[Airport]:
        """Walk the frameset to the nav menu, emit every aerodrome as IFR,
        then attach direct chart-PDF links. ``last_url``/``last_html`` track
        the most recent fetch so a failure can dump the offending page for
        post-mortem debugging via ``save_response``."""
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. Walk the frame chain from the frameset index to the nav HTML.
            nav_url, nav_html = self.follow_frame_chain(
                ROOT_URL, ["eAISNavigationBase", "eAISNavigation"]
            )
            last_url, last_html = nav_url, nav_html

            # 2. One chapter per aerodrome; all are type "ifr" per the spec.
            airports.extend(self._extract_airport_sections(nav_html, nav_url))

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"CZ crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
