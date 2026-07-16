"""Cyprus (DCA Cyprus) "Open Cyprus VFR Manual" crawler.

Source: the Department of Civil Aviation (DCA Cyprus, Ministry of Transport,
Communications and Works) publishes an open, session-free **VFR Manual** at
`http://vfrmanual.dca.mcw.gov.cy/`. It is a bespoke static frameset (not a
eurocontrol eAIP), whose left menu (`menu.html`) links, under "LOCAL VFR CHARTS
(pdf)", one VFR chart PDF per civil aerodrome:

    [Local VFR Chart Larnaka] ./charts/VFR_CHART_LCLK.pdf
    [Local VFR Chart Pafos]   ./charts/VFR_CHART_LCPH.pdf
    [Local VFR CYPRUS]        ./charts/VFR_CHART_LCCC.pdf   (country-wide chart)

DCA Cyprus publishes the two civil international aerodromes in the
Republic-controlled area (Larnaka LCLK, Pafos LCPH); the `LCCC` sheet is the
Nicosia-FIR-wide VFR chart, NOT an aerodrome, so it is excluded by the label
(aerodrome charts read "Local VFR Chart <name>"; the country chart reads
"Local VFR CYPRUS"). The `LANDING_STRIPS_HELIPADS.html` appendix is parsed too
for any extra strip/helipad that carries its own `VFR_CHART_<code>.pdf`.

Pure static HTTP over plain `http://`, no JS render, no login, no proxy. LC is
the Cyprus ICAO prefix.
"""

import re
from urllib.parse import urljoin

from crawlers.http_base import Airport, HttpCrawlerBase
from crawlers.models import ChartLink

COUNTRY = "CY"

ROOT_URL = "http://vfrmanual.dca.mcw.gov.cy/"
MENU_URL = urljoin(ROOT_URL, "menu.html")
STRIPS_URL = urljoin(ROOT_URL, "html/LANDING_STRIPS_HELIPADS.html")
# The manual carries its edition history here; the newest dated row is forwarded
# to crawl_meta.airac so the detail page can show a "last edition" line (the
# chart URLs carry no date - the manual is not AIRAC-cycle published).
UPDATES_URL = urljoin(ROOT_URL, "html/RECORD_OF_UPDATES.html")

# Per-aerodrome chart links: href `.../charts/VFR_CHART_<CODE>.pdf`, label
# "Local VFR Chart <name>". The country-wide "Local VFR CYPRUS" sheet (LCCC)
# does NOT match the "... Chart <name>" label, so it is naturally excluded.
_CHART_HREF_RE = re.compile(r"VFR_CHART_([A-Z]{4})\.pdf$", re.I)
_CHART_LABEL_RE = re.compile(r"^Local VFR Chart\s+(.+)$", re.I)

# The Nicosia FIR / country-wide chart code, never an aerodrome (belt-and-braces
# on top of the label filter).
_NOT_AERODROME = {"LCCC"}

# A date in the record-of-updates page, e.g. "30 APR 2019" / "30-APR-2019".
_DATE_RE = re.compile(r"(\d{1,2})[ \-]([A-Z]{3})[ \-](\d{4})", re.I)
_MONTHS = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04", "may": "05", "jun": "06",
    "jul": "07", "aug": "08", "sep": "09", "oct": "10", "nov": "11", "dec": "12",
}


class CY(HttpCrawlerBase):
    """Cyprus DCA "Open Cyprus VFR Manual" crawler - static VFR-chart tree.

    Reads the menu (and the landing-strips appendix) for each aerodrome's VFR
    chart PDF and emits it as a "vfr" field whose url / pdf_url is that chart.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _extract_from(self, html: str, base_url: str) -> list[Airport]:
        """Emit one "vfr" Airport per aerodrome VFR-chart link on a page.

        Matches anchors whose href is `VFR_CHART_<ICAO>.pdf` and whose label
        reads "Local VFR Chart <name>", so the country-wide LCCC sheet and any
        non-chart links are skipped. Deduped by ICAO within the page.
        """
        soup = self.soup(html)
        airports: list[Airport] = []
        seen: set[str] = set()
        for a in soup.find_all("a", href=True):
            m = _CHART_HREF_RE.search(a["href"])
            if not m:
                continue
            icao = m.group(1).upper()
            if icao in _NOT_AERODROME or icao in seen:
                continue
            label = self.clean_text(a.get_text(" ", strip=True))
            name_match = _CHART_LABEL_RE.match(label)
            if not name_match:
                continue
            seen.add(icao)
            name = name_match.group(1).strip()
            pdf = urljoin(base_url, a["href"])
            airports.append(
                Airport(
                    country=self.country,
                    icao=icao,
                    title=f"{name} {icao}",
                    url=pdf,
                    pdf_url=pdf,
                    charts=[
                        ChartLink(name=f"VFR Chart {name} ({icao})", url=pdf)
                    ],
                    type="vfr",  # type: ignore[call-arg]
                )
            )
        return airports

    def _airac_from_updates(self, html: str) -> str | None:
        """Newest dated row in the record-of-updates page, as an ISO date."""
        best: tuple[int, int, int] | None = None
        for d, mon, y in _DATE_RE.findall(html):
            month = _MONTHS.get(mon.lower())
            if not month:
                continue
            key = (int(y), int(month), int(d))
            if best is None or key > best:
                best = key
        if best is None:
            return None
        return f"{best[0]:04d}-{best[1]:02d}-{best[2]:02d}"

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url, last_html = MENU_URL, None

        try:
            menu_html = self.fetch(MENU_URL)
            last_html = menu_html
            airports = self._extract_from(menu_html, MENU_URL)

            # Extra strips/helipads that carry their own chart (fail-soft).
            try:
                strips_html = self.fetch(STRIPS_URL)
                seen = {a.icao for a in airports}
                for extra in self._extract_from(strips_html, STRIPS_URL):
                    if extra.icao not in seen:
                        seen.add(extra.icao)
                        airports.append(extra)
            except Exception as e:
                self.logger.info(f"CY: no extra landing-strip charts: {e}")

            if not airports:
                hrefs = [
                    a["href"][:80]
                    for a in self.soup(menu_html).find_all("a", href=True)
                ][:40]
                raise ValueError(
                    f"CY: no aerodrome chart links found in {MENU_URL}. "
                    f"Hrefs: {hrefs}"
                )

            # Forward the manual's newest edition date to crawl_meta.airac
            # (the chart URLs carry no date). Fail-soft: no AIRAC line on error.
            try:
                self.airac = self._airac_from_updates(self.fetch(UPDATES_URL))
            except Exception as e:
                self.logger.info(f"CY: could not resolve edition date: {e}")
        except Exception as e:
            self.logger.error(f"CY crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
