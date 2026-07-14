"""Serbia VFR AIP crawler (SMATSA - https://smatsa.rs/).

Serbia's IFR eAIP is behind a paid "Order Form" subscription (out of reach),
but SMATSA publishes a FREE public **VFR AIP** as a bespoke frameset, NOT a
eurocontrol eAIP - so neither HttpEurocontrolBase nor a static fetch works:

  - the entry `.../vfraip/published/htm/osnovna.html` is a 3-frame set
    (header / `indeks.html` index / cover); `indeks.html` links the AD page
    at `.../htm/ad.html`;
  - `ad.html` is **client-rendered**: a plain httpx fetch returns an empty
    shell (title "-", zero links), but after its JS runs the DOM carries every
    aerodrome's PDF documents. So RS needs a headless render (like DK), hence
    PlaywrightCrawlerBase (probe run 29324445784).

Every per-aerodrome artifact is a PDF under `.../published/pdf/adr/`, named
`VFR_LY_AD_2_<KEY>_en.pdf` (the aerodrome-data sheet) plus chart sub-documents
`VFR_LY_AD_2_<KEY>_<section>_en.pdf`, e.g.

    VFR_LY_AD_2_LYBE_en.pdf        AERODROME DATA
    VFR_LY_AD_2_LYBE_2-1-1_en.pdf  AERODROME CHART (ADC)
    VFR_LY_AD_2_LYBE_2-4-1_en.pdf  VISUAL OPERATION CHART (VAC)
    VFR_LY_AD_2_LYBE_9-1-1_en.pdf  VFR FLIGHT PROCEDURES

`<KEY>` is the ICAO for coded fields (LYBE, LYNI, ...) or a plain name for
uncoded airfields (BLACE). One aerodrome = one `<KEY>`: all its PDFs are
grouped, the VAC is the primary chart link (then the ADC, then the data
sheet), and the whole set is stored in `charts`. The aerodrome-data sheet has
no name in its link text, so titles come from `_NAMES` with the ICAO/KEY as
fallback (the same pattern as LT); an unmapped field still lists.
"""

from __future__ import annotations

import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.models import ChartLink
from crawlers.playwright_base import PlaywrightCrawlerBase, PlaywrightUnavailable

COUNTRY = "RS"
# "published" (not a dated edition) is stable across AIRAC cycles; the PDFs
# behind it are replaced in place, so the htm entry never needs re-resolving.
AD_URL = "https://smatsa.rs/upload/vfraip/published/htm/ad.html"

# A per-aerodrome PDF: VFR_LY_AD_2_<KEY>[_<section>]_en.pdf. <KEY> is the ICAO
# (LYxx) or an uncoded field name (BLACE); <section> (2-1-1, 2-4-1, 9-1-1 ...)
# is present only on chart documents, absent on the data sheet. AD 1.x index
# PDFs (VFR_LY_AD_1_3_en.pdf) are AD_1 and never match.
_AD2_PDF_RE = re.compile(
    r"VFR_LY_AD_2_([A-Z][A-Z0-9]*?)(?:_(\d[\d-]*))?_en\.pdf$", re.I
)
_ICAO_RE = re.compile(r"^LY[A-Z]{2}$")
_MAX_CHARTS = 50

# Aerodrome names from the SMATSA VFR AIP AD 1.3 "Index of Aerodromes and
# Heliports" (the source is the joint Serbia / Montenegro VFR AIP, so a few
# fields are Montenegrin - Podgorica/Tivat/Nikšić). Official Serbian-Latin
# names. An unmapped KEY still lists (ICAO/KEY as its title), so a newly
# published field is caught; the website also enriches by ICAO (OurAirports).
_NAMES = {
    "LYBE": "Beograd Nikola Tesla",
    "LYBJ": "Beograd Lisičiji Jarak",
    "LYCA": "Čačak Ravan",
    "LYCU": "Ćuprija",
    "LYVA": "Divci",
    "LYKT": "Kostolac",
    "LYKG": "Kragujevac",
    "LYKA": "Kraljevo Brege",
    "LYKV": "Kraljevo Morava",
    "LYKS": "Kruševac Rosulje",
    "LYKU": "Kula",
    "LYNK": "Nikšić Kapino polje",
    "LYNI": "Niš Konstantin Veliki",
    "LYVJ": "Nova Pazova Vojka",
    "LYNS": "Novi Sad Čenej",
    "LYPA": "Pančevo",
    "LYPN": "Paraćin Davidovac",
    "LYPG": "Podgorica",
    "LYPO": "Podgorica Ćemovsko polje",
    "LYPJ": "Pranjani Galovića polje",
    "LYPR": "Priština",
    "LYPT": "Priština Batlava",
    "LYSD": "Smederevo Radinac",
    "LYSP": "Smederevska Palanka Rudine",
    "LYSM": "Sremska Mitrovica Veliki Radinci",
    "LYSU": "Subotica",
    "LYTV": "Tivat",
    "LYTR": "Trstenik",
    "LYUZ": "Užice Ponikve",
    "LYVR": "Vršac",
    "LYZP": "Zemun Polje",
    "LYZR": "Zrenjanin Ečka",
    "BLACE": "Blace",
    "BOGATIC": "Bogatić",
    "ZABREZJE": "Zabrežje",
}


class RS(PlaywrightCrawlerBase):
    def __init__(self) -> None:
        super().__init__(COUNTRY)

    @staticmethod
    def _chart_label(text: str, url: str) -> str:
        """Human-readable chart designation: the link text where the source
        gives a real one, else the PDF filename (without extension)."""
        name = " ".join((text or "").split())
        if not name or name.upper().startswith("PODACI O AERODROMU"):
            # The data-sheet link text is generic Serbian/English boilerplate;
            # fall back to the filename so the charts list stays meaningful.
            name = url.rsplit("/", 1)[-1][:-4]
        return name[:120]

    def crawl(self) -> list[Airport]:
        """Headless-render the JS-built AD page, group its per-aerodrome PDFs
        by KEY, and emit one VFR Airport per aerodrome. A missing/unlaunchable
        browser (PlaywrightUnavailable) or a render error fails soft (returns
        no airports) rather than raising, since RS is a best-effort source."""
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []

        try:
            # ad.html is client-rendered: only after its JS runs does the DOM
            # carry the aerodrome PDF links, so a plain fetch is not enough.
            html = self.render_html(AD_URL, wait_until="networkidle")
        except PlaywrightUnavailable as e:
            self.logger.error(f"RS: headless render unavailable: {e}")
            self.close()
            return airports
        except Exception as e:
            self.logger.error(f"RS: rendering {AD_URL} failed: {e}")
            self.close()
            return airports

        try:
            # Group every AD-2 PDF document by its aerodrome KEY, preserving
            # first-seen order so the listing follows the AIP's own sequence.
            order: list[str] = []
            by_key: dict[str, list[ChartLink]] = {}
            for a in self.soup(html).find_all("a", href=True):
                href = a["href"]
                match = _AD2_PDF_RE.search(href)
                if not match:
                    continue
                key = match.group(1).upper()
                url = urljoin(AD_URL, href)
                label = self._chart_label(a.get_text(" ", strip=True), url)
                if key not in by_key:
                    by_key[key] = []
                    order.append(key)
                if not any(c.url == url for c in by_key[key]):
                    by_key[key].append(ChartLink(name=label, url=url))

            self.logger.info(f"RS: AD page lists {len(order)} aerodromes: {order}")

            for key in order:
                charts = by_key[key][:_MAX_CHARTS]
                # Primary chart: VAC (2-4-1 visual operation chart) is the most
                # useful for VFR, then the ADC (2-1-1), then the data sheet
                # (the document with no chart-section suffix), then anything.
                vac = next((c.url for c in charts if "_2-4-1_" in c.url), None)
                adc = next((c.url for c in charts if "_2-1-1_" in c.url), None)
                data = next(
                    (
                        c.url
                        for c in charts
                        if (m := _AD2_PDF_RE.search(c.url)) and m.group(2) is None
                    ),
                    None,
                )
                primary = vac or adc or data or charts[0].url
                # Coded fields (LYxx) get a real ICAO; uncoded ones (BLACE) have
                # none, so icao stays None and the name/KEY carries the title.
                icao = key if _ICAO_RE.match(key) else None
                title = _NAMES.get(key) or icao or key.title()
                airports.append(
                    Airport(
                        country=COUNTRY,
                        icao=icao,
                        title=title,
                        url=primary,
                        pdf_url=primary,
                        charts=charts or None,
                        type="vfr",
                    )
                )
        except Exception as e:
            self.logger.error(f"RS crawl failed: {e}")
            self.save_response(AD_URL, html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
