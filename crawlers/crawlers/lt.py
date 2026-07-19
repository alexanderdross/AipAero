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

On top of those four international aerodromes the crawler merges the separate
open "AIP VFR LITHUANIA" (issue #35): a flat PDF tree at
``ans.lt/a1/aip_vfr/aip_vfr_<edition>/`` whose landing page links one chart PDF
per small VFR field (``pdf/<placename>.pdf``, place-named, no ICAO). GEN/ENR
front matter is filtered out; the fields are deduped against the AD-2 list and
appended as name-only ``vfr`` entries. Fully fail-soft.
"""

from __future__ import annotations

import datetime
import os
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport, HttpCrawlerBase, current_airac_date
from crawlers.http_eurocontrol_base import ad23_hours
from crawlers.models import ChartLink

COUNTRY = "LT"
SUPPLEMENTS_URL = (
    "https://www.ans.lt/en/information-publications/aip-aip-supplements"
)

# The separate open "AIP VFR LITHUANIA" - a flat PDF tree the eAIP (4
# international aerodromes) omits (issue #35). The root is an Apache index of
# dated editions (aip_vfr_11jun2026/); each edition's landing page links one
# chart PDF per small VFR field under pdf/<placename>.pdf, plus GEN/ENR front
# matter that is filtered out. No ICAO in the source - fields are place-named.
VFR_ROOT_URL = "https://www.ans.lt/a1/aip_vfr/"
# aip_vfr_11jun2026/ or aip_vfr_79_16apr2026/ -> the edition's effective date.
_VFR_EDITION_RE = re.compile(r"aip_vfr_(?:\d+_)?(\d{1,2})([a-z]{3})(\d{4})/?$", re.I)
_VFR_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}
# A field PDF's stem is an all-lowercase place name (klaipeda, paluknys_av);
# GEN/ENR front matter carries digits / uppercase / dots and is skipped.
_VFR_FIELD_STEM_RE = re.compile(r"^[a-z]+(?:_[a-z]+)*$")
_VFR_SKIP_STEMS = {"amdt"}

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

    def _resolve_vfr_edition(self) -> str | None:
        """The newest ``aip_vfr_<ddmmmyyyy>/`` edition directory under the open
        VFR root (the dated path changes each AIRAC cycle, so it is discovered,
        not hardcoded). None on any failure - the VFR merge is optional."""
        try:
            html = self.fetch(VFR_ROOT_URL)
        except Exception as e:
            self.logger.warning(f"LT: VFR root fetch failed: {e}")
            return None
        best_url: str | None = None
        best_date: datetime.date | None = None
        for a in self.soup(html).find_all("a", href=True):
            m = _VFR_EDITION_RE.search(a["href"].strip())
            if not m:
                continue
            month = _VFR_MONTHS.get(m.group(2).lower())
            if not month:
                continue
            try:
                d = datetime.date(int(m.group(3)), month, int(m.group(1)))
            except ValueError:
                continue
            if best_date is None or d > best_date:
                best_date, best_url = d, urljoin(VFR_ROOT_URL, a["href"])
        if best_url and not best_url.endswith("/"):
            best_url += "/"
        # Remember the real resolved edition date so crawl() can stamp
        # crawl_meta.airac from the actual source date (more accurate than the
        # 28-day schedule approximation).
        self._vfr_edition_date = best_date
        return best_url

    def _crawl_vfr_manual(self) -> list[Airport]:
        """Small VFR fields from the open "AIP VFR LITHUANIA" PDF tree.

        The current edition's landing page links one chart PDF per field under
        ``pdf/<placename>.pdf`` (place-named, no ICAO), plus GEN/ENR front
        matter that is filtered out. A field's extra sheet (``paluknys_av.pdf``
        next to ``paluknys.pdf``) rides as a second chart on the same field.
        Fully fail-soft: any failure returns [] so the eAIP crawl still stands.
        """
        base = self._resolve_vfr_edition()
        if not base:
            self.logger.info("LT: no VFR edition found - skipping VFR manual")
            return []
        try:
            html = self.fetch(base)
        except Exception as e:
            self.logger.warning(f"LT: VFR index fetch failed ({base}): {e}")
            return []

        # Group PDFs by base field name (stem before the first underscore).
        fields: dict[str, list[ChartLink]] = {}
        order: list[str] = []
        for a in self.soup(html).find_all("a", href=True):
            href = a["href"].strip()
            if not href.lower().endswith(".pdf"):
                continue
            stem = href.rsplit("/", 1)[-1][:-4].lower()
            # Keep only place-name stems; drop AMDT/GEN/ENR front matter.
            if (
                stem in _VFR_SKIP_STEMS
                or stem.startswith(("gen", "enr"))
                or not _VFR_FIELD_STEM_RE.match(stem)
            ):
                continue
            field = stem.split("_")[0]
            if field not in fields:
                fields[field] = []
                order.append(field)
            # First chart of a field is the plain <field>.pdf (the aerodrome
            # VFR chart); label it "VFR", any extra sheet by its suffix.
            suffix = stem[len(field) :].strip("_")
            name = suffix.upper() if suffix else "VFR"
            if len(fields[field]) < _MAX_CHARTS:
                fields[field].append(
                    ChartLink(name=name, url=urljoin(base, href))
                )

        airports: list[Airport] = []
        for field in order:
            charts = fields[field]
            # Primary = the plain "VFR" sheet where present, else the first.
            primary = next(
                (c for c in charts if c.name == "VFR"), charts[0]
            )
            airports.append(
                Airport(
                    country=COUNTRY,
                    icao=None,
                    title=field.replace("_", " ").title(),
                    url=primary.url,
                    pdf_url=primary.url,
                    charts=charts,
                    type="vfr",
                )
            )
        self.logger.info(
            f"LT: VFR manual added {len(airports)} fields from {base}"
        )
        return airports

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = SUPPLEMENTS_URL
        last_html: str | None = None

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
                # AD 2.3 OPERATIONAL HOURS is in this same eAIP page (full
                # eurocontrol-style AD 2 HTML). Parse the page we ALREADY hold -
                # never a second fetch: every LT request goes through the
                # metered Web Unlocker. Fail-soft; the parser isolates row 1.
                try:
                    hrs = ad23_hours(" ".join(self.soup(ad2_html).get_text(" ").split()))
                    if hrs:
                        self.hours_by_icao[icao] = hrs
                except Exception as e:
                    self.logger.debug(f"LT: {icao} AD 2.3 hours failed: {e}")
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

            # Merge the separate open VFR manual (small fields the eAIP omits),
            # deduped by ICAO/title against the AD-2 aerodromes above. Fail-soft.
            seen = {(a.icao or a.title or "").upper() for a in airports}
            for field in self._crawl_vfr_manual():
                key = (field.icao or field.title or "").upper()
                if key in seen:
                    continue
                seen.add(key)
                airports.append(field)

            # Stamp crawl_meta.airac. Prefer the REAL resolved VFR-manual
            # edition date (set by _resolve_vfr_edition above); fall back to the
            # 28-day schedule if it could not be resolved. Fail-soft.
            edition_date = getattr(self, "_vfr_edition_date", None)
            self.airac = (
                edition_date.isoformat() if edition_date else current_airac_date()
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
