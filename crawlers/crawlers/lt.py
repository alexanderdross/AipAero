"""Lithuania AIP crawler (ANS Lithuania eAIP - https://www.ans.lt/).

The Lithuanian eAIP is a eurocontrol-style eAIP, but three quirks rule out the
generic HttpEurocontrolBase menu flow:

  - the whole site is behind a WAF that 403s datacenter IPs (direct AND the
    plain Bright Data proxy) - only the Bright Data Web Unlocker gets 200, the
    same class of gate as GR (probe run 29318563895);
  - there is NO standard English navigation menu (menu-en-US.html is 404) and
    the eAIP index is JS/frame-driven, so the aerodrome inventory is read from
    the AD 1.3 "Index to Aerodromes" page instead;
  - the edition path is deeply dated
    (/a1/aip/<edition>/<timestamp>/html/eAIP/), resolved at runtime from the
    public "AIP & AIP supplements" page -> the "View eAIP in browser"
    start.html -> its single link to index-en-US.html (no hardcoded edition).

Per aerodrome the English AD 2 page (EY-AD-2-<ICAO>-en-US.html) lists every
chart PDF as a plain <a href="../pdf/EY-AD-2-<ICAO>-<TYPE>.pdf">; the VFR
visual approach chart (VAC) is the primary pdf_url, the aerodrome chart (ADC)
the fallback, and the full set is stored in `charts`.
"""

from __future__ import annotations

import os
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport, HttpCrawlerBase
from crawlers.models import ChartLink

COUNTRY = "LT"
SUPPLEMENTS_URL = (
    "https://www.ans.lt/en/information-publications/aip-aip-supplements"
)

# Public discovery hops (no hardcoded edition path).
_START_HREF_RE = re.compile(r"/a1/aip/[^\"'\s>]+/start\.html", re.I)
_INDEX_HREF_RE = re.compile(r"index-[a-z]{2}-[A-Z]{2}\.html", re.I)
# Aerodrome AD-2 links on the AD 1.3 index -> the ICAO.
_AD2_ICAO_RE = re.compile(r"EY-AD-2-([A-Z]{4})-(?:en-US|lt-LT)\.html", re.I)
# A chart PDF on an AD 2 page (the /pdf/old/ superseded copies are skipped).
_CHART_PDF_RE = re.compile(r"EY-AD-2-[A-Z]{4}-.*\.pdf$", re.I)
_MAX_CHARTS = 50

# The Lithuanian international aerodromes (stable). An ICAO not in the map
# still lists, with the code alone as the title, so a new aerodrome is caught.
_NAMES = {
    "EYVI": "Vilnius",
    "EYKA": "Kaunas",
    "EYPA": "Palanga",
    "EYSA": "Šiauliai",
}


class LT(HttpCrawlerBase):
    def __init__(self) -> None:
        super().__init__(COUNTRY)
        # The source WAFs non-browser user agents; send a browser fingerprint.
        self.use_browser_headers()
        # ans.lt 403s both the direct request and the plain proxy (verified in
        # the probe); only the Web Unlocker zone clears the gate (the GR path).
        unlocker = os.environ.get("BRIGHTDATA_UNLOCKER_URL", "").strip()
        proxy = os.environ.get("BRIGHTDATA_PROXY_URL", "").strip()
        if unlocker:
            self.logger.info("LT: routing via Bright Data Web Unlocker")
            self.use_proxy(unlocker)
        elif proxy:
            self.logger.warning(
                "LT: only BRIGHTDATA_PROXY_URL set - the plain proxy does NOT "
                "clear the ans.lt WAF (verified 403); set BRIGHTDATA_UNLOCKER_URL"
            )
            self.use_proxy(proxy)
        else:
            self.logger.warning(
                "LT: no BRIGHTDATA_UNLOCKER_URL / BRIGHTDATA_PROXY_URL set - "
                "ans.lt will 403 this crawl"
            )

    def _resolve_eaip_base(self) -> str:
        """Discover the current-edition eAIP directory (…/html/eAIP/) without
        hardcoding the dated path: supplements page -> the "View eAIP in
        browser" start.html -> the index page it links -> parent + 'eAIP/'."""
        supp = self.fetch(SUPPLEMENTS_URL)
        start_match = _START_HREF_RE.search(supp)
        if not start_match:
            raise ValueError("LT: no start.html link on the supplements page")
        start_url = urljoin(SUPPLEMENTS_URL, start_match.group(0))

        start_html = self.fetch(start_url)
        index_url: str | None = None
        for a in self.soup(start_html).find_all("a", href=True):
            if _INDEX_HREF_RE.search(a["href"]):
                index_url = urljoin(start_url, a["href"])
                break
        if index_url is None:
            raise ValueError(f"LT: no index-<lang>.html link on {start_url}")

        # …/<timestamp>/html/index-en-US.html -> …/<timestamp>/html/eAIP/
        base = index_url.rsplit("/", 1)[0] + "/eAIP/"
        self.logger.info(f"LT eAIP base: {base}")
        return base

    @staticmethod
    def _aerodrome_icaos(ad13_html: str) -> list[str]:
        """Ordered, de-duplicated ICAO list from the AD 1.3 AD-2 links."""
        seen: list[str] = []
        for m in _AD2_ICAO_RE.finditer(ad13_html):
            icao = m.group(1).upper()
            if icao not in seen:
                seen.append(icao)
        return seen

    def _charts(
        self, ad2_html: str, ad2_url: str
    ) -> tuple[str | None, list[ChartLink]]:
        """Every chart PDF an AD 2 page links (VAC preferred, then ADC, for the
        primary pick), skipping the superseded /pdf/old/ copies."""
        charts: list[ChartLink] = []
        seen: set[str] = set()
        vac: str | None = None
        adc: str | None = None
        for a in self.soup(ad2_html).find_all("a", href=True):
            href = a["href"]
            if ".pdf" not in href.lower() or "/old/" in href.lower():
                continue
            if not _CHART_PDF_RE.search(href):
                continue
            url = urljoin(ad2_url, href)
            if url in seen:
                continue
            seen.add(url)
            name = " ".join(a.get_text(" ", strip=True).split())
            if not name:
                name = url.rsplit("/", 1)[-1][:-4]
            if len(charts) < _MAX_CHARTS:
                charts.append(ChartLink(name=name[:120], url=url))
            upper = url.upper()
            if vac is None and "-VAC" in upper:
                vac = url
            if adc is None and "-ADC" in upper:
                adc = url
        primary = vac or adc or (charts[0].url if charts else None)
        return primary, charts

    def _recon_vfr_dir(self, url: str, depth: int = 0) -> None:
        """TEMP (log-only) recon: walk the open LT VFR-AIP directory index
        (ans.lt/a1/aip_vfr/) up to 2 levels deep, logging every entry so the
        per-field structure (HTML pages vs PDFs) becomes visible. Fail-soft;
        removed once _crawl_vfr_manual is implemented (issue #35)."""
        try:
            html = self.fetch(url)
        except Exception as e:
            self.logger.info(f"LT VFRRECON fetch FAIL {url}: {e}")
            return
        soup = self.soup(html)
        title = soup.title.get_text(strip=True) if soup.title else "-"
        entries = []
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            # Skip Apache autoindex sort/parent links.
            if href.startswith("?") or href in ("/a1/", "../") or "Parent" in a.get_text():
                continue
            entries.append(href)
        pdfs = [h for h in entries if h.lower().endswith(".pdf")]
        htmls = [h for h in entries if h.lower().endswith((".html", ".htm"))]
        subdirs = [h for h in entries if h.endswith("/")]
        self.logger.info(
            f"LT VFRRECON d{depth} {url} | title={title!r} | "
            f"{len(entries)} entries: {len(subdirs)} dirs, "
            f"{len(htmls)} html, {len(pdfs)} pdf"
        )
        for h in entries[:60]:
            self.logger.info(f"LT VFRRECON  d{depth} entry: {h[:120]}")
        # Descend into subdirs (bounded) to reveal per-field layout.
        if depth < 2:
            for sub in subdirs[:6]:
                self._recon_vfr_dir(urljoin(url, sub), depth + 1)

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = SUPPLEMENTS_URL
        last_html: str | None = None

        # TEMP: descend the open VFR-AIP directory (issue #35); log-only.
        try:
            self._recon_vfr_dir("https://www.ans.lt/a1/aip_vfr/aip_vfr_11jun2026/")
        except Exception as e:
            self.logger.warning(f"LT VFRRECON failed: {e}")

        try:
            # AD 1.3 "Index to Aerodromes" is the inventory source (there is no
            # usable English nav menu); its AD-2 links give the ICAO list.
            base = self._resolve_eaip_base()
            ad13_url = urljoin(base, "EY-AD-1.3-en-US.html")
            last_url = ad13_url
            last_html = self.fetch(ad13_url)
            icaos = self._aerodrome_icaos(last_html)
            self.logger.info(
                f"LT: AD 1.3 lists {len(icaos)} aerodromes: {icaos}"
            )

            for icao in icaos:
                # Per-aerodrome English AD 2 page follows a fixed filename
                # shape; a single field failing to fetch is skipped (fail-soft)
                # rather than aborting the whole country.
                ad2_url = urljoin(base, f"EY-AD-2-{icao}-en-US.html")
                try:
                    ad2_html = self.fetch(ad2_url)
                except Exception as e:
                    self.logger.warning(f"LT: {icao} AD-2 fetch failed: {e}")
                    continue
                pdf_url, charts = self._charts(ad2_html, ad2_url)
                # Prefix the known name where mapped; an unmapped ICAO titles as
                # the bare code (still lists, website enriches via OurAirports).
                title = f"{_NAMES.get(icao, '')} {icao}".strip()
                airports.append(
                    Airport(
                        country=COUNTRY,
                        icao=icao,
                        title=title,
                        url=ad2_url,
                        pdf_url=pdf_url,
                        charts=charts or None,
                        type="vfr",
                    )
                )
        except Exception as e:
            self.logger.error(f"LT crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
