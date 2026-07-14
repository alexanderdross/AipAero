import re
from urllib.parse import urljoin

from crawlers.http_base import Airport, HttpCrawlerBase
from crawlers.http_eurocontrol_base import ad21_name

COUNTRY = "ES"
# ENAIRE serves the AIP as ONE static index page per language with every
# section directly linked (probe_eaip runs 29255990091 / 29258057165: ~1800
# plain links like `contenido_AIP/GEN/LE_GEN_0_1_en.html`). No frameset, no
# edition picker - the index always points at the current effective content.
# NOT a eurocontrol eAIP; owner explicitly commissioned it anyway.
ROOT_URL = "https://aip.enaire.es/AIP/AIP-en.html"

# AD 2 section pages: `contenido_AIP/AD/LE_AD_2_LEMD_en.html` (exact filename
# shape unverified before the first live run - keep the pattern permissive:
# anything under contenido_AIP/AD/ naming AD 2 plus a Spanish ICAO code).
_AD2_HREF_RE = re.compile(
    r"contenido_AIP/AD/[^\"']*AD[_\- ]?2[_\- ]([A-Z]{4})[^\"']*_en\.html",
    re.I,
)


class ES(HttpCrawlerBase):
    """Spain AIP crawler (ENAIRE, task spec: europe-expansion.md).

    Parses the English AIP index page for AD 2 aerodrome section links.
    Titles come from the anchor's own text when present, else from the
    surrounding table row, else fall back to the ICAO code - the live-test
    run shows the real markup for iteration. Aerodromes are emitted as
    "vfr" (NO/PL/SE convention).
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def crawl(self) -> list[Airport]:
        """Fetch the single ENAIRE AIP index page, harvest every AD 2
        aerodrome section link (one per ICAO), derive a title, and emit each
        as VFR. No frame walk - the index is one flat HTML page. ``last_html``
        retains the page so a failure can dump it for post-mortem debugging."""
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            html = self.fetch(ROOT_URL)
            last_html = html
            soup = self.soup(html)

            # The index links each AD 2 section many times (charts, text, ...);
            # `seen` keeps only the first hit per ICAO so a field lists once.
            seen: set[str] = set()
            for a in soup.find_all("a", href=True):
                m = _AD2_HREF_RE.search(a["href"])
                if not m:
                    continue
                icao = m.group(1).upper()
                if icao in seen:
                    continue
                seen.add(icao)

                # The ENAIRE index row carries NO aerodrome name (only the ICAO
                # + the boilerplate label "Aerodrome data."); the name lives on
                # the AD 2 sub-page's "AD 2.1 AERODROME LOCATION INDICATOR AND
                # NAME" line. Fetch the page and read it (fail-soft: fall back
                # to the bare ICAO when the page or the line is unavailable).
                url = urljoin(ROOT_URL, a["href"])
                name: str | None = None
                try:
                    text = " ".join(
                        self.soup(self.fetch(url)).get_text(" ").split()
                    )
                    name = ad21_name(text, icao)
                except Exception as e:  # one bad page must not abort the crawl
                    self.logger.warning(f"ES: {icao} name fetch failed: {e}")
                if not name:
                    self.logger.warning(f"ES: no AD 2.1 name for {icao}")
                title = f"{name} {icao}".strip() if name else icao

                airports.append(
                    Airport(
                        country=self.country,
                        icao=icao,
                        title=title,
                        url=url,
                        type="vfr",
                    )
                )

            if not airports:
                raise ValueError(f"No AD 2 links found in {ROOT_URL}")

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"ES crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
