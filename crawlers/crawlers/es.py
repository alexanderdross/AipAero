import re
from urllib.parse import urljoin

from crawlers.http_base import Airport, HttpCrawlerBase, current_airac_date
from crawlers.http_eurocontrol_base import ad21_debug_snippet, ad21_name, ad23_hours
from crawlers.models import ChartLink

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

# The AD 2.24 chart PDFs are siblings of the AD-2 text page in the index (ES
# DEBUG recon run 29346896167): `LE_AD_2_<ICAO>_<TYPE>_<N>_en.pdf` where TYPE
# is a chart designator (ADC aerodrome chart, VAC visual approach, GMC ground
# movement, APDC/PDC parking, AOC obstacle, PATC, SID, STAR, IAC...). The bare
# `LE_AD_2_<ICAO>_en.pdf` (the full AD-2 document, no TYPE) is deliberately not
# matched - it is not a single chart. A few aerodromes share a combined folder
# under a DUAL designator (LECU/LEVS - MADRID/Cuatro Vientos), whose charts are
# filed as `LE_AD_2_LECU_LEVS_<TYPE>_<N>_en.pdf` (both keys, verified 200 via
# check_urls run 29372181084); the optional `(?:_[A-Z]{4})?` captures that
# second ICAO without shifting the group indices (group 1 stays the first ICAO,
# which is the ICAO the field is emitted under).
_CHART_HREF_RE = re.compile(
    r"contenido_AIP/AD/[^\"']*/LE_AD_2_([A-Z]{4})(?:_[A-Z]{4})?_([A-Z]{2,8})_(\d+)_en\.pdf$",
    re.I,
)
# Primary chart preference: the visual approach chart first (VFR site), then
# the aerodrome chart, then ground-movement/parking, else the first captured.
_CHART_PRIORITY = ("VAC", "ADC", "GMC", "APDC", "PDC", "AOC")
_MAX_CHARTS = 50  # cap per field (the API stores at most 50)


def _pick_primary(charts: list[ChartLink]) -> str | None:
    """The most relevant chart URL for the detail page's chart box, by
    designation preference (VAC -> ADC -> ...), else the first captured."""
    for pref in _CHART_PRIORITY:
        for c in charts:
            if c.name.upper().startswith(pref):
                return c.url
    return charts[0].url if charts else None


class ES(HttpCrawlerBase):
    """Spain AIP crawler (ENAIRE, task spec: europe-expansion.md).

    Parses the English AIP index page for AD 2 aerodrome section links.
    Titles come from the anchor's own text when present, else from the
    surrounding table row, else fall back to the ICAO code - the live-test
    run shows the real markup for iteration. Aerodromes are emitted as
    "vfr" (NO/PL/SE convention).
    """

    # Tesseract language for the pdf_text OCR fallback (image-only AD-2 PDFs).
    PDF_OCR_LANG = "spa+eng"

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
            # ENAIRE index URL carries no edition date; stamp on-cycle AIRAC.
            self.airac = current_airac_date()

            # Collect every AD 2.24 chart PDF per ICAO from the index in one
            # pass (the charts are siblings of the AD-2 text page, so no extra
            # fetch per field is needed). Order-stable, deduped, capped.
            charts_by_icao: dict[str, list[ChartLink]] = {}
            for a in soup.find_all("a", href=True):
                cm = _CHART_HREF_RE.search(a["href"])
                if not cm:
                    continue
                ic = cm.group(1).upper()
                designation = f"{cm.group(2).upper()} {cm.group(3)}"  # "ADC 1"
                curl = urljoin(ROOT_URL, a["href"])
                lst = charts_by_icao.setdefault(ic, [])
                if len(lst) < _MAX_CHARTS and all(c.url != curl for c in lst):
                    lst.append(ChartLink(name=designation, url=curl))

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
                    if not name:
                        self.logger.warning(
                            f"ES: no AD 2.1 name for {icao}; "
                            f"markup: {ad21_debug_snippet(text)!r}"
                        )
                except Exception as e:  # one bad page must not abort the crawl
                    self.logger.warning(f"ES: {icao} name fetch failed: {e}")

                # AD 2.3 OPERATIONAL HOURS is NOT on the HTML landing page (which
                # carries only the AD 2.1 name) - it lives in the full-document
                # AD-2 PDF (same path, `.html` -> `.pdf`; ENAIRE excludes that
                # bare-ICAO PDF from the chart set). Extract its text and run the
                # source-agnostic ad23_hours parser (row-1 isolation handles the
                # "1 Airport V: 0430-2230; I: ..." ENAIRE row-1 shape; verified
                # LECO -> 04:30-22:30). OpenAIP has no hours for ES, so this PDF
                # is the only source. One extra PDF fetch per field; fail-soft.
                try:
                    pdf_url = re.sub(r"\.html?$", ".pdf", url, flags=re.I)
                    hrs = ad23_hours(self.pdf_text(pdf_url))
                    if hrs:
                        self.hours_by_icao[icao] = hrs
                        if self._last_pdf_ocr:
                            self.hours_source_by_icao[icao] = "pdf-ocr-hours"
                except Exception as e:
                    self.logger.debug(f"ES: {icao} AD 2.3 hours failed: {e}")
                title = f"{name} {icao}".strip() if name else icao

                # Attach the field's AD 2.24 chart PDFs (from the index pass);
                # the primary is the direct chart-box link (VAC/ADC preferred).
                charts = charts_by_icao.get(icao) or []
                airports.append(
                    Airport(
                        country=self.country,
                        icao=icao,
                        title=title,
                        url=url,
                        pdf_url=_pick_primary(charts),
                        charts=charts or None,
                        type="vfr",
                    )
                )

            if not airports:
                raise ValueError(f"No AD 2 links found in {ROOT_URL}")
            pdf_n = sum(1 for a in airports if a.pdf_url)
            self.logger.info(f"ES: chart-PDF coverage {pdf_n}/{len(airports)}")
        except Exception as e:
            self.logger.error(f"ES crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
