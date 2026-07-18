"""Bulgaria (BULATSA) AIP crawler - the b-flip Flight Information Portal.

BULATSA publishes the official Bulgarian AIP + charts **openly** (no login) on
the b-flip portal (`b-flip.bulatsa.com`). The earlier "gated" verdict was wrong:
the AD-2/AD-4/AD-5 chart PDFs are free static files under `/_aip/AD_files/`,
e.g.

    https://b-flip.bulatsa.com/_aip/AD_files/LB_AD_2_LBBG_59_1_2_3_4_en.pdf

The catch is the navigation: b-flip is a bespoke Angular SPA (built by
TechnoLogica), so a plain httpx fetch of `/publications/aip/aerodromes` returns
only the app shell - the aerodrome table is injected client-side. So BG renders
the Aerodromes page with headless Chromium (like DK/RS) and parses the rendered
`#aip_content` table.

The table groups fields under three AD parts, each a chart PDF family:

  * AD 2 - the 5 international aerodromes (LBSF Sofia, LBBG Burgas, LBWN Varna,
    LBGO Gorna Oryahovitsa, LBPD Plovdiv) - full chart sets (ADC/PDC/SID/STAR/
    IAC/VAC ...), type `vfr`.
  * AD 4 - ~31 small VFR aerodromes (< 5700 kg) - a textual-data sheet, some
    with a VAC, type `vfr`.
  * AD 5 - 5 heliports - a textual-data sheet, type `heliport`.

Every chart PDF is named `LB_AD_<part>_<ICAO>_<section>_en.pdf` (section absent
= the textual-data sheet, `59` = Visual Approach Chart / VAC, `41` = Aerodrome
Chart / ADC). PDFs are grouped by the ICAO in their OWN filename (the source
table carries a few stray cross-links, so grouping by header would mis-assign
them - the RS pattern); the VAC is the primary chart, then the ADC, then the
data sheet. Names come from the table's header rows (Cyrillic / Latin, the
Latin half kept). LB is the Bulgaria ICAO prefix.
"""

from __future__ import annotations

import re
from urllib.parse import urljoin

from crawlers.http_base import Airport, current_airac_date
from crawlers.models import ChartLink
from crawlers.playwright_base import PlaywrightCrawlerBase, PlaywrightUnavailable

COUNTRY = "BG"
ROOT_URL = "https://b-flip.bulatsa.com/"
# Deep-links the Aerodromes tab directly (its `aria-selected` is set on load),
# so the AD table renders without any in-app navigation.
AD_PAGE_URL = "https://b-flip.bulatsa.com/publications/aip/aerodromes"

# A per-aerodrome chart/data PDF: LB_AD_<part>_<ICAO>[_<section...>]_en.pdf.
# <part> is 2/4/5 (AD 2 / AD 4 / AD 5); <section> (41, 43, 53, 59, ...) is the
# eAIP chart index, absent on the textual-data sheet. The AIC circulars linked
# in the same table live under /cd/... and never match this AD_files pattern.
_AD_PDF_RE = re.compile(
    r"/_aip/AD_files/LB_AD_(\d)_(LB[A-Z0-9]{2})((?:_\d+)*)_en\.pdf$", re.I
)
_ICAO_RE = re.compile(r"\bLB[A-Z0-9]{2}\b")
_MAX_CHARTS = 50


class BG(PlaywrightCrawlerBase):
    """Bulgaria (BULATSA b-flip) chart crawler.

    Renders the Angular Aerodromes page, reads aerodrome names from the header
    rows and groups the `/_aip/AD_files/LB_AD_*` chart PDFs by ICAO. Fails soft
    (0 airports) when the headless browser is unavailable, like DK/RS.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    @staticmethod
    def _latin_name(cell_text: str) -> str:
        """The aerodrome name from a header cell "<Cyrillic> / <Latin>".

        The table names each field bilingually ("БУРГАС / BURGAS"); keep the
        Latin half (after the last "/") and title-case the ALL-CAPS source
        ("VASIL LEVSKI - SOFIA" -> "Vasil Levski - Sofia"). Falls back to the
        whole (title-cased) string when there is no "/".
        """
        name = " ".join((cell_text or "").split())
        if "/" in name:
            name = name.rsplit("/", 1)[-1].strip()
        return name.title() if name.isupper() else name

    def _read_names(self, html: str) -> dict[str, str]:
        """Map ICAO -> Latin aerodrome name from the AD table's header rows.

        Header rows carry `class="tr_head"`; an aerodrome header has the ICAO
        (LB**) in its code cell and the bilingual name in the next cell, while a
        part header ("AD 2", "AERODROMES") has no LB** code and is skipped.
        """
        names: dict[str, str] = {}
        for tr in self.soup(html).select("tr.tr_head"):
            cells = tr.find_all("td")
            if len(cells) < 4:
                continue
            code_text = cells[2].get_text(" ", strip=True)
            m = _ICAO_RE.search(code_text)
            # Skip part headers ("AD 2", "AD 4", ...) - no LB** code, or the
            # cell reads "AD <n>" rather than an ICAO.
            if not m or code_text.strip().upper().startswith("AD "):
                continue
            icao = m.group(0).upper()
            name = self._latin_name(cells[3].get_text(" ", strip=True))
            if name and icao not in names:
                names[icao] = name
        return names

    def _parse_ad_table(self, html: str) -> list[Airport]:
        """Turn the rendered Aerodromes-page HTML into a list of Airports.

        Pure (no network / browser) so it is unit-testable against a captured
        fragment: reads the header-row names, groups every `/_aip/AD_files/`
        chart PDF by the ICAO in its own filename, picks the primary chart
        (VAC > ADC > data sheet) and emits one Airport per aerodrome.
        """
        names = self._read_names(html)

        # Group every AD_files PDF by the ICAO IN ITS OWN filename (robust
        # against the table's stray cross-links), preserving first-seen order
        # so the listing follows the AIP's own sequence.
        order: list[str] = []
        parts: dict[str, str] = {}
        by_icao: dict[str, list[ChartLink]] = {}
        for a in self.soup(html).find_all("a", href=True):
            abs_url = urljoin(ROOT_URL, a["href"].strip())
            match = _AD_PDF_RE.search(abs_url)
            if not match:
                continue
            part, icao = match.group(1), match.group(2).upper()
            label = " ".join(a.get_text(" ", strip=True).split())
            if not label:
                label = abs_url.rsplit("/", 1)[-1][:-4]
            if icao not in by_icao:
                by_icao[icao] = []
                parts[icao] = part
                order.append(icao)
            if not any(c.url == abs_url for c in by_icao[icao]):
                by_icao[icao].append(ChartLink(name=label[:120], url=abs_url))

        self.logger.info(f"BG: AD table lists {len(order)} aerodromes: {order}")

        airports: list[Airport] = []
        for icao in order:
            charts = by_icao[icao][:_MAX_CHARTS]
            # Primary chart: VAC (section 59, best for VFR), then ADC (41),
            # then the textual-data sheet (no section suffix), else the first.
            vac = next((c.url for c in charts if _section_is(c.url, "59")), None)
            adc = next((c.url for c in charts if _section_is(c.url, "41")), None)
            data = next(
                (
                    c.url
                    for c in charts
                    if (m := _AD_PDF_RE.search(c.url)) and not m.group(3)
                ),
                None,
            )
            primary = vac or adc or data or charts[0].url
            # AD 5 = heliports; AD 2 / AD 4 = vfr aerodromes.
            category = "heliport" if parts[icao] == "5" else "vfr"
            # Title convention "<name> <ICAO>" (drives the list, the map popup
            # label and the detail heading); fall back to the code when the
            # header row carried no Latin name.
            name = names.get(icao)
            title = f"{name} {icao}" if name else icao
            airports.append(
                Airport(
                    country=COUNTRY,
                    icao=icao,
                    title=title,
                    url=primary,
                    pdf_url=primary,
                    charts=charts or None,
                    type=category,  # type: ignore[call-arg]
                )
            )
        return airports

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []

        try:
            # The AD table is Angular-injected; render it before parsing. Wait
            # for the first chart PDF anchor so the content (not just the shell)
            # is present, with a short settle for late XHRs.
            html = self.render_html(
                AD_PAGE_URL,
                wait_until="networkidle",
                wait_selector="a[href*='AD_files']",
                wait_ms=1500,
            )
        except PlaywrightUnavailable as e:
            self.logger.error(f"BG: headless render unavailable: {e}")
            self.close()
            return airports
        except Exception as e:
            self.logger.error(f"BG: rendering {AD_PAGE_URL} failed: {e}")
            self.close()
            return airports

        # The b-flip chart PDFs carry no edition date in their filenames (they
        # are replaced in place each cycle), so stamp the current AIRAC so the
        # detail page still shows the cycle.
        self.airac = current_airac_date()

        try:
            airports = self._parse_ad_table(html)
        except Exception as e:
            self.logger.error(f"BG crawl failed: {e}")
            self.save_response(AD_PAGE_URL, html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports


def _section_is(url: str, section: str) -> bool:
    """True if the AD_files PDF ``url``'s first section token equals ``section``
    (e.g. "59" for a VAC: LB_AD_2_LBBG_59_1_2_3_4_en.pdf)."""
    m = _AD_PDF_RE.search(url)
    if not m or not m.group(3):
        return False
    return m.group(3).lstrip("_").split("_")[0] == section
