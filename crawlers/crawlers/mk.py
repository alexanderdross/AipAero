"""North Macedonia (M-NAV) eAIP crawler.

Source: M-NAV (the North Macedonian ANSP) publishes an open eAIP at
`ais.m-nav.info/eAIP/`. The `current` alias always points at the effective
edition, so no date resolution is needed. This is an OLDER, custom M-NAV
generator (circa-2018 vintage), NOT the modern eurocontrol `<div id="AD 2...
details">` menu that `HttpEurocontrolBase` parses - so it gets its own small
`HttpCrawlerBase` parser.

The no-JavaScript navigation page `eAIP/current/en/index-nonframe.htm` lists
every aerodrome as an anchor ("LWSK - Skopje", "LWOH - Ohrid"; LW is the North
Macedonia ICAO prefix). The linked per-field HTML pages do NOT exist as static
files (the framed viewer needs JavaScript), but each aerodrome's complete AD 2
document IS published as a single combined PDF in the browsable directory
`eAIP/current/pdf/aerodromes/LW_AD_2_<ICAO>_en.pdf` (verified 200). So the
crawler reads the nav for the ICAO + name and points each field's url / pdf_url
straight at that AD 2 PDF (it carries the aerodrome chart). Pure HTML nav +
static PDFs, no JS render, no login, no proxy.
"""

import re
from urllib.parse import urljoin

from crawlers.http_base import Airport, HttpCrawlerBase
from crawlers.http_eurocontrol_base import ad23_hours
from crawlers.models import ChartLink

COUNTRY = "MK"

# The `current` alias resolves the effective edition; the no-JS nav page lists
# the aerodrome links inline (the framed menu.htm needs JavaScript).
NAV_URL = "https://ais.m-nav.info/eAIP/current/en/index-nonframe.htm"
# Browsable directory of the per-aerodrome AD 2 PDFs (one combined doc each).
PDF_BASE = "https://ais.m-nav.info/eAIP/current/pdf/aerodromes/"
# The top frame carries the effective edition as `AIP (15-JUL-2026)`; the chart
# URLs use the date-less `current` alias, so the crawler forwards this edition
# to crawl_meta.airac (like DE) so the detail page can show the AIRAC cycle.
TOP_URL = "https://ais.m-nav.info/eAIP/current/en/top.htm"
_AIRAC_RE = re.compile(r"AIP\s*\((\d{2})-([A-Z]{3})-(\d{4})\)", re.I)
_MONTHS = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04", "may": "05", "jun": "06",
    "jul": "07", "aug": "08", "sep": "09", "oct": "10", "nov": "11", "dec": "12",
}

# Aerodrome anchors read "LWSK - Skopje" and link "../html/lwsk.htm". Match the
# ICAO + name in the text and confirm the href points at a per-field AD 2 page
# (`html/lw<xx>.htm`), so the "AD 2 Aerodromes" section header and the GEN/AD
# index PDF links are skipped. (The linked HTML 404s; the URL we keep is the
# AD 2 PDF built from the ICAO, not this href.)
_AD_TEXT_RE = re.compile(r"^(LW[A-Z]{2})\s*-\s*(.+)$")
_AD_HREF_RE = re.compile(r"/html/lw[a-z]{2}\.htm(?:[?#].*)?$", re.I)


class MK(HttpCrawlerBase):
    """North Macedonia (M-NAV) AIP crawler - open custom eAIP.

    Reads the no-JS nav page and emits each aerodrome (LWSK/LWOH) as a "vfr"
    field whose url / pdf_url is its combined AD 2 chart PDF.
    """

    # Tesseract language for the pdf_text OCR fallback (the ~2018 M-NAV AD-2
    # PDFs are often image-only, so this is the crawler most likely to use it).
    PDF_OCR_LANG = "mkd+eng"

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    @staticmethod
    def _pdf_url(icao: str) -> str:
        """The aerodrome's combined AD 2 PDF (carries the aerodrome chart)."""
        return urljoin(PDF_BASE, f"LW_AD_2_{icao.upper()}_en.pdf")

    @staticmethod
    def _airac_from_top(html: str) -> str | None:
        """Parse the effective edition ("AIP (15-JUL-2026)") into an ISO date."""
        m = _AIRAC_RE.search(html)
        if not m:
            return None
        month = _MONTHS.get(m.group(2).lower())
        return f"{m.group(3)}-{month}-{m.group(1)}" if month else None

    def _extract_airports(self, nav_html: str) -> list[Airport]:
        """Parse the no-JS nav page into one "vfr" Airport per aerodrome link.

        Matches anchors whose text reads "LWxx - <name>" and whose href points
        at a per-field AD 2 page, so the "AD 2 Aerodromes" section header and
        the GEN/AD index PDF links are skipped. Each field's url / pdf_url is
        the combined AD 2 PDF built from its ICAO. Deduped by ICAO. Raises when
        nothing matches (markup drift -> caught by the crawl).
        """
        soup = self.soup(nav_html)
        airports: list[Airport] = []
        seen: set[str] = set()
        for a in soup.find_all("a", href=True):
            if not _AD_HREF_RE.search(a["href"]):
                continue
            text = self.clean_text(a.get_text(" ", strip=True))
            m = _AD_TEXT_RE.match(text)
            if not m:
                continue
            icao = m.group(1).upper()
            if icao in seen:
                continue
            seen.add(icao)
            name = m.group(2).strip()
            pdf = self._pdf_url(icao)
            # AD 2.3 OPERATIONAL HOURS lives in this combined AD-2 PDF (the same
            # one we link as the chart). Extract its text and parse row 1. The
            # ~2018 M-NAV PDFs may be image-only -> pdf_text empty -> no hours
            # (fail-soft, never a crash).
            try:
                hrs = ad23_hours(self.pdf_text(pdf))
                if hrs:
                    self.hours_by_icao[icao] = hrs
                    if self._last_pdf_ocr:
                        self.hours_source_by_icao[icao] = "pdf-ocr-hours"
            except Exception as e:
                self.logger.debug(f"MK: {icao} AD 2.3 hours failed: {e}")
            airports.append(
                Airport(
                    country=self.country,
                    icao=icao,
                    title=f"{name} {icao}",
                    url=pdf,
                    pdf_url=pdf,
                    charts=[ChartLink(name=f"AD 2 {icao} - Aerodrome chart", url=pdf)],
                    type="vfr",
                )
            )

        if not airports:
            hrefs = [a["href"][:80] for a in soup.find_all("a", href=True)][:40]
            raise ValueError(
                f"MK: no aerodrome links found in {NAV_URL}. Hrefs: {hrefs}"
            )
        return airports

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url, last_html = NAV_URL, None

        try:
            nav_html = self.fetch(NAV_URL)
            last_html = nav_html
            airports = self._extract_airports(nav_html)

            # Forward the effective edition to crawl_meta.airac (the chart URLs
            # use the date-less `current` alias). Fail-soft: no AIRAC on error.
            try:
                self.airac = self._airac_from_top(self.fetch(TOP_URL))
            except Exception as e:
                self.logger.info(f"MK: could not resolve AIRAC edition: {e}")
        except Exception as e:
            self.logger.error(f"MK crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
