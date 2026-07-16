"""North Macedonia (M-NAV) eAIP crawler.

Source: M-NAV (the North Macedonian ANSP) publishes an open eAIP at
`ais.m-nav.info/eAIP/`. The `current` alias always points at the effective
edition, so no date resolution is needed. This is an OLDER, custom M-NAV
generator (circa-2018 vintage), NOT the modern eurocontrol `<div id="AD 2...
details">` menu that `HttpEurocontrolBase` parses - so it gets its own small
`HttpCrawlerBase` parser.

The no-JavaScript navigation page `eAIP/current/en/index-nonframe.htm` lists
every aerodrome directly as an anchor:

    <a href="../html/lwsk.htm">LWSK - Skopje</a>
    <a href="../html/lwoh.htm">LWOH - Ohrid</a>

so the crawler reads that page and emits one "vfr" field per `LWxx - <name>`
link (LW is the North Macedonia ICAO prefix). Each field's `url` is its AD 2
aerodrome page; the AD 2.24 chart PDFs it links (under `../pdf/aerodromes/`)
are captured as `pdf_url` by the Stage-2 chart extraction. Pure HTML, no JS
render, no login, no proxy.
"""

import re
from urllib.parse import urljoin

from crawlers.http_base import Airport, HttpCrawlerBase

COUNTRY = "MK"

# The `current` alias resolves the effective edition; the no-JS nav page lists
# the aerodrome links inline (the framed menu.htm needs JavaScript).
NAV_URL = "https://ais.m-nav.info/eAIP/current/en/index-nonframe.htm"

# Aerodrome anchors read "LWSK - Skopje" and link "../html/lwsk.htm". Match the
# ICAO + name in the text and confirm the href points at a per-field AD 2 page
# (`html/lw<xx>.htm`), so the "AD 2 Aerodromes" section header and the GEN/AD
# index PDF links are skipped.
_AD_TEXT_RE = re.compile(r"^(LW[A-Z]{2})\s*-\s*(.+)$")
_AD_HREF_RE = re.compile(r"/html/lw[a-z]{2}\.htm(?:[?#].*)?$", re.I)


class MK(HttpCrawlerBase):
    """North Macedonia (M-NAV) AIP crawler - open custom eAIP.

    Reads the no-JS nav page and emits each aerodrome (LWSK/LWOH) as a "vfr"
    field pointing at its AD 2 page; the AD 2.24 chart PDFs become pdf_url.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    # Chart-PDF extraction: M-NAV's AD 2.24 charts sit under pdf/aerodromes/ as
    # LW_AD_2_<ICAO>_..._en.pdf; prefer the VAC / ADC aerodrome sheet.
    FETCH_PDF_URLS = True
    PDF_HREF_PRIORITY = (r"_VAC", r"_ADC", r"AD_2.*24", r"_en\.pdf")

    def _extract_airports(self, nav_html: str) -> list[Airport]:
        """Parse the no-JS nav page into one "vfr" Airport per aerodrome link.

        Matches anchors whose text reads "LWxx - <name>" and whose href points
        at a per-field AD 2 page (`html/lw<xx>.htm`), so the "AD 2 Aerodromes"
        section header and the GEN/AD index PDF links are skipped. Deduped by
        ICAO. Raises when nothing matches (markup drift -> caught by the crawl).
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
            airports.append(
                Airport(
                    country=self.country,
                    icao=icao,
                    title=f"{name} {icao}",
                    url=urljoin(NAV_URL, a["href"]),
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

            # Stage 2: capture direct AD 2.24 chart-PDF links (fail-soft).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"MK crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
