"""Greece (Hellenic AIS / HASP) AIP crawler.

Source: `aisgr.hasp.gov.gr`. The public `main.php` landing is a reCAPTCHA gate
and Bright Data refuses to proxy the bare `.gov` host, BUT each AIRAC edition is
published as a **static, self-contained tree** under a dated folder:

    https://aisgr.hasp.gov.gr/aipgr_incl_amdt_<NNYY>_wef_<ddMMMyyyy>/cd/ais/
        ├─ indexaip.htm            (frameset)
        ├─ AIP-menu.htm            (the side menu: 700+ direct PDF links)
        └─ eaip/pdf/AD 2/AD2-<ICAO>/LG_AD_2_<ICAO>_VFR_en.pdf   (VFR chart)
                                    LG_AD_2_<ICAO>_en.pdf        (full AD 2 text)
           eaip/pdf/AD 3/AD3-<KEY>/LG_AD_3_<KEY>_VFR_en.pdf     (heliport chart)

Direct httpx to these deep paths still 403s (WAF), but the **Bright Data proxy
returns 200** for them (unlike the bare landing) - verified live (run
29443933237). So this crawler routes through the proxy, resolves the currently
effective edition folder, reads `AIP-menu.htm`, and harvests the AD 2 aerodrome
and AD 3 heliport chart PDFs directly from its links. No captcha, no browser,
no eurocontrol frameset parsing.
"""

import datetime
import os
import re
from urllib.parse import unquote, urljoin

from crawlers.http_base import Airport, HttpCrawlerBase

COUNTRY = "GR"
# The portal landing that lists / links the currently effective edition. It is
# fetched through the proxy; we scrape the edition folder token out of it.
ROOT_URL = "https://aisgr.hasp.gov.gr/main.php?rand=0.5"
HOST = "https://aisgr.hasp.gov.gr/"

_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

# Edition folder: aipgr_incl_amdt_<NNYY>_wef_<dd><mmm><yyyy> (e.g.
# aipgr_incl_amdt_0626_wef_09jul2026). Capture the effective date so the
# currently effective edition can be picked without parsing the captcha page.
_EDITION_RE = re.compile(
    r"aipgr_incl_amdt_\d{4}_wef_(\d{2})([a-z]{3})(\d{4})", re.I
)

# AD 2 aerodrome VFR chart PDF (href is URL-decoded before matching, so the
# "AD 2" folder space is a literal space). Group 1 = the ICAO (LGxx).
_AD2_VFR_RE = re.compile(
    r"/AD 2/AD2-([A-Z]{4})/LG_AD_2_[A-Z]{4}_VFR_en\.pdf$", re.I
)
# AD 2 full aerodrome text PDF (the non-VFR sheet), same folder.
_AD2_TXT_RE = re.compile(
    r"/AD 2/AD2-([A-Z]{4})/LG_AD_2_[A-Z]{4}_en\.pdf$", re.I
)
# AD 3 heliport chart PDF. The KEY is a place name (Greek island helipads
# rarely have an ICAO), so it is not constrained to 4 letters.
_AD3_RE = re.compile(
    r"/AD 3/AD3-([^/]+)/LG_AD_3_[^/]+?(_VFR)?_en\.pdf$", re.I
)
# Strip the "AD 3.12 " chapter prefix from a heliport's menu link text.
_AD3_TITLE_PREFIX_RE = re.compile(r"^AD\s*3\.\d+\s*", re.I)


class GR(HttpCrawlerBase):
    """Greece (Hellenic AIS - https://aisgr.hasp.gov.gr/) AIP crawler.

    Reads the static per-edition AIP tree through the Bright Data proxy (the
    bare host is captcha-gated and Bright Data blocks the `.gov` landing, but
    the deep static edition paths proxy through at 200). Harvests AD 2
    aerodrome VFR charts and AD 3 heliport charts straight from the
    `AIP-menu.htm` link list.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)
        # The WAF 403s non-browser UAs; the deep paths still need the proxy.
        self.use_browser_headers()
        unlocker = os.environ.get("BRIGHTDATA_UNLOCKER_URL", "").strip()
        proxy_url = os.environ.get("BRIGHTDATA_PROXY_URL", "").strip()
        if unlocker:
            self.logger.info("GR: routing via Bright Data Web Unlocker")
            self.use_proxy(unlocker)
        elif proxy_url:
            self.logger.info("GR: routing via Bright Data proxy")
            self.use_proxy(proxy_url)
        else:
            self.logger.warning(
                "GR: no BRIGHTDATA_UNLOCKER_URL / BRIGHTDATA_PROXY_URL set - "
                "the HASP WAF will block this crawl"
            )

    def _resolve_edition_base(
        self, html: str, today: datetime.date | None = None
    ) -> str:
        """Return the currently effective edition's `.../cd/ais/` base URL.

        Scans the landing HTML for `aipgr_incl_amdt_..._wef_<date>` folder
        tokens and picks the latest edition whose effective date is on or
        before ``today`` (falling back to the earliest if all are future).
        """
        today = today or datetime.date.today()
        editions: list[tuple[datetime.date, str]] = []
        seen: set[str] = set()
        for m in _EDITION_RE.finditer(html):
            token = m.group(0)
            if token in seen:
                continue
            seen.add(token)
            day, mon, year = int(m.group(1)), m.group(2).lower(), int(m.group(3))
            month = _MONTHS.get(mon)
            if not month:
                continue
            try:
                eff = datetime.date(year, month, day)
            except ValueError:
                continue
            editions.append((eff, token))
        if not editions:
            raise ValueError(
                "No 'aipgr_incl_amdt_..._wef_...' edition token found on the "
                "HASP landing page"
            )
        in_effect = [e for e in editions if e[0] <= today]
        eff, token = (
            max(in_effect, key=lambda e: e[0])
            if in_effect
            else min(editions, key=lambda e: e[0])
        )
        self.logger.info(
            f"GR current edition (effective {eff.isoformat()}): {token}"
        )
        # Set the AIRAC edition (ISO) for the website's "Stand: ... AIRAC" line;
        # GR stores date-in-URL PDFs, but the menu HTML itself carries no date.
        self.airac = eff.isoformat()
        return f"{HOST}{token}/cd/ais/"

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. Landing page (via proxy) -> currently effective edition base.
            root_html = self.fetch(ROOT_URL)
            last_url, last_html = ROOT_URL, root_html
            base = self._resolve_edition_base(root_html)

            # 2. The side menu carries every publication as a direct PDF link.
            menu_url = urljoin(base, "AIP-menu.htm")
            menu_html = self.fetch(menu_url)
            last_url, last_html = menu_url, menu_html

            airports = self._parse_menu(menu_html, menu_url)
            if not airports:
                raise ValueError(f"No AD 2/AD 3 charts found in {menu_url}")
        except Exception as e:
            self.logger.error(f"GR crawl failed: {e}")
            if last_html is not None:
                self.log_candidate_links(last_html, last_url, limit=60)
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports

    def _parse_menu(self, html: str, base_url: str) -> list[Airport]:
        """Harvest AD 2 aerodromes (vfr) and AD 3 heliports from the menu links.

        Each aerodrome has a VFR chart (primary) and a full-AD-2 text PDF; each
        heliport has one chart PDF named by place. Titles: AD 2 fields carry no
        name in the menu (ICAO only), so the ICAO is the title and the website
        enriches the town from OpenAIP/OurAirports; AD 3 heliports use the menu
        place name.
        """
        soup = self.soup(html)
        # Per aerodrome: {icao: {"vfr": url, "txt": url}}; heliports: list.
        ad2: dict[str, dict[str, str]] = {}
        heliports: list[Airport] = []
        heli_seen: set[str] = set()

        for a in soup.find_all("a", href=True):
            href = unquote(a["href"])
            abs_url = urljoin(base_url, a["href"])
            text = " ".join(a.get_text(" ", strip=True).split())

            m2v = _AD2_VFR_RE.search(href)
            if m2v:
                ad2.setdefault(m2v.group(1).upper(), {})["vfr"] = abs_url
                continue
            m2t = _AD2_TXT_RE.search(href)
            if m2t:
                ad2.setdefault(m2t.group(1).upper(), {})["txt"] = abs_url
                continue
            m3 = _AD3_RE.search(href)
            if m3:
                key = m3.group(1)
                if key in heli_seen:
                    continue
                heli_seen.add(key)
                name = _AD3_TITLE_PREFIX_RE.sub("", text).strip() or unquote(key)
                # A LGxx key is a real ICAO; otherwise the field is name-only.
                icao = key.upper() if re.fullmatch(r"[A-Z]{4}", key.upper()) else None
                heliports.append(
                    Airport(
                        country=self.country,
                        icao=icao,
                        title=f"{name} {icao}".strip() if icao else name,
                        url=abs_url,
                        type="heliport",
                        pdf_url=abs_url,
                    )
                )

        airports: list[Airport] = []
        for icao, sheets in sorted(ad2.items()):
            primary = sheets.get("vfr") or sheets.get("txt")
            if not primary:
                continue
            charts = []
            if sheets.get("vfr"):
                charts.append({"name": f"{icao} VFR", "url": sheets["vfr"]})
            if sheets.get("txt"):
                charts.append({"name": f"AD 2 {icao}", "url": sheets["txt"]})
            airports.append(
                Airport(
                    country=self.country,
                    icao=icao,
                    title=icao,
                    url=primary,
                    type="vfr",
                    pdf_url=sheets.get("vfr") or primary,
                    charts=charts or None,
                )
            )

        airports.extend(heliports)
        self.logger.info(
            f"GR: {len(ad2)} AD 2 aerodromes, {len(heliports)} AD 3 heliports"
        )
        return airports
