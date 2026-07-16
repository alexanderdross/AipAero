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
HOST = "https://aisgr.hasp.gov.gr/"
# Kept for the unit tests / diagnostics; the crawler no longer fetches the
# captcha-gated main.php (Bright Data 502s that dynamic .gov page). The current
# edition folder is derived from the AIRAC schedule + a static-folder probe.
ROOT_URL = "https://aisgr.hasp.gov.gr/main.php?rand=0.5"

_MONTH_ABBR = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
]

# A known AIRAC effective date to anchor the fixed 28-day cycle (matches the
# 09 JUL 2026 edition folder). Any real AIRAC date works as the anchor.
_AIRAC_ANCHOR = datetime.date(2026, 7, 9)

# Edition folder: aipgr_incl_amdt_<NNYY>_wef_<dd><mmm><yyyy> (e.g.
# aipgr_incl_amdt_0626_wef_09jul2026). Used to recognise/parse folder tokens.
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
# AD 3 heliport chart PDF. Unlike AD 2, all heliports live in ONE folder and
# are numbered with a hyphenated place name (no ICAO - Greek island helipads):
#   eaip/pdf/ad 3/HELIPORTS/LG_AD_3_<n>_<PLACE-NAME>_en.pdf
# The AD 3.0 preface (LG_AD_3_0_en.pdf, no name) does not match (no name group).
_AD3_RE = re.compile(
    r"/ad ?3/HELIPORTS/LG_AD_3_\d+_([A-Z0-9][A-Z0-9-]*)_en\.pdf$", re.I
)
# Strip the "AD 3.12 " chapter prefix from a heliport's menu link text.
_AD3_TITLE_PREFIX_RE = re.compile(r"^AD\s*3\.\d+\s*", re.I)

# Aerodrome names by ICAO. The HASP AIP-menu.htm AD 2 links carry only the ICAO
# (no place name), so the title would otherwise be a bare code; this static map
# (names from OurAirports, CC0 / public domain) restores the "<name> <ICAO>"
# convention on the list, map and detail heading. An unmapped ICAO falls back to
# the bare code (the website still enriches the town from OpenAIP/OurAirports).
_NAMES: dict[str, str] = {
    "LGAV": "Athens / Eleftherios Venizelos",
    "LGTS": "Thessaloniki / Makedonia",
    "LGIR": "Heraklion / Nikos Kazantzakis",
    "LGKR": "Corfu / Ioannis Kapodistrias",
    "LGRP": "Rhodes / Diagoras",
    "LGKO": "Kos / Ippokratis",
    "LGSR": "Santorini",
    "LGMT": "Mytilene / Lesbos",
    "LGSM": "Samos",
    "LGKV": "Kavala / Alexander the Great",
    "LGZA": "Zakynthos / Dionysios Solomos",
    "LGKF": "Kefalonia",
    "LGPZ": "Aktion / Preveza",
    "LGAL": "Alexandroupoli / Democritus",
    "LGKL": "Kalamata",
    "LGSK": "Skiathos",
    "LGMK": "Mykonos",
    "LGRX": "Araxos / Patras",
    "LGHI": "Chios",
    "LGLM": "Limnos",
    "LGNX": "Naxos",
    "LGPA": "Paros",
    "LGKP": "Karpathos",
    "LGKC": "Kithira",
    "LGML": "Milos",
    "LGST": "Sitia",
    "LGIO": "Ioannina / King Pyrrhus",
    "LGKZ": "Kozani / Filippos",
    "LGBL": "Nea Anchialos / Volos",
    "LGAD": "Andravida",
    "LGTL": "Kasteli",
    "LGLR": "Larissa",
    "LGKY": "Kalymnos",
    "LGIK": "Ikaria",
    "LGSA": "Chania / Souda",
    "LGSO": "Syros",
    "LGTG": "Tanagra",
    "LGAG": "Agrinion",
    "LGEL": "Elefsina",
    "LGKN": "Marathon / Kotroni",
    "LGKA": "Kastoria / Aristotle",
    "LGKJ": "Kastelorizo",
    "LGKS": "Kasos",
    "LGLE": "Leros",
    "LGPL": "Astypalaia",
    "LGSY": "Skyros",
}


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
        # The static per-edition tree needs only IP-based WAF bypass, NOT the
        # captcha/JS solving of the Web Unlocker (we no longer touch main.php).
        # Prefer the PLAIN proxy: it is far faster (the Unlocker renders JS on
        # every request, ~10-15s each, which makes the AMDT probe unusable).
        if proxy_url:
            self.logger.info("GR: routing via Bright Data proxy")
            self.use_proxy(proxy_url)
        elif unlocker:
            self.logger.info("GR: routing via Bright Data Web Unlocker")
            self.use_proxy(unlocker)
        else:
            self.logger.warning(
                "GR: no BRIGHTDATA_PROXY_URL / BRIGHTDATA_UNLOCKER_URL set - "
                "the HASP WAF will block this crawl"
            )

    def _resolve_edition_base(
        self, html: str, today: datetime.date | None = None
    ) -> str:
        """Return the effective edition base URL from a listing's HTML.

        Scans for `aipgr_incl_amdt_..._wef_<date>` folder tokens and picks the
        latest whose effective date is on or before ``today``. Kept as a
        helper (and unit-tested) for any reachable listing; the live crawl uses
        ``_find_current_edition`` instead, because the only page that lists the
        editions (main.php) is captcha-gated and Bright Data 502s it.
        """
        today = today or datetime.date.today()
        editions: list[tuple[datetime.date, str]] = []
        seen: set[str] = set()
        for m in _EDITION_RE.finditer(html):
            token = m.group(0)
            if token in seen:
                continue
            seen.add(token)
            eff = self._token_date(m)
            if eff is not None:
                editions.append((eff, token))
        if not editions:
            raise ValueError("No 'aipgr_incl_amdt_..._wef_...' token in HTML")
        in_effect = [e for e in editions if e[0] <= today]
        eff, token = (
            max(in_effect, key=lambda e: e[0])
            if in_effect
            else min(editions, key=lambda e: e[0])
        )
        self.airac = eff.isoformat()
        return f"{HOST}{token}/cd/ais/"

    @staticmethod
    def _token_date(m: re.Match) -> datetime.date | None:
        day, mon, year = int(m.group(1)), m.group(2).lower(), int(m.group(3))
        if mon not in _MONTH_ABBR:
            return None
        try:
            return datetime.date(year, _MONTH_ABBR.index(mon) + 1, day)
        except ValueError:
            return None

    @staticmethod
    def airac_dates_on_or_before(
        today: datetime.date, count: int = 3
    ) -> list[datetime.date]:
        """The ``count`` most recent AIRAC effective dates on/before ``today``.

        AIRAC effective dates follow a fixed global 28-day cycle; anchoring on
        one known date reproduces the whole schedule with no network call.
        Newest first.
        """
        k = (today - _AIRAC_ANCHOR).days // 28
        return [_AIRAC_ANCHOR + datetime.timedelta(days=28 * (k - i))
                for i in range(count)]

    @staticmethod
    def _edition_token(amdt: int, wef: datetime.date) -> str:
        wef_str = f"{wef.day:02d}{_MONTH_ABBR[wef.month - 1]}{wef.year}"
        return f"aipgr_incl_amdt_{amdt:02d}{wef.year % 100:02d}_wef_{wef_str}"

    def _find_current_edition(
        self, today: datetime.date | None = None
    ) -> tuple[str, str]:
        """Locate the effective edition's AIP-menu.htm without main.php.

        For each recent AIRAC effective date (newest first), the edition folder
        embeds an AMDT number we cannot derive, so probe the static folders
        directly (`aipgr_incl_amdt_<NN><YY>_wef_<date>/cd/ais/AIP-menu.htm`) -
        there is exactly one AMDT per effective date. The first folder that
        answers 200 through the proxy is the current edition. Returns
        (menu_url, menu_html) and sets ``self.airac``.
        """
        today = today or datetime.date.today()
        # A missing folder answers 404/502 through the proxy; probe with NO
        # retries so each miss is one quick request (the default 3x backoff
        # would make the AMDT sweep take minutes).
        saved_retries = self.max_retries
        self.max_retries = 1
        try:
            for wef in self.airac_dates_on_or_before(today, count=3):
                for amdt in range(1, 14):
                    token = self._edition_token(amdt, wef)
                    menu_url = f"{HOST}{token}/cd/ais/AIP-menu.htm"
                    try:
                        menu_html = self.fetch(menu_url)
                    except Exception:
                        continue  # missing folder - try the next AMDT
                    self.logger.info(
                        f"GR current edition: {token} (AIRAC {wef.isoformat()})"
                    )
                    self.airac = wef.isoformat()
                    return menu_url, menu_html
        finally:
            self.max_retries = saved_retries
        raise ValueError(
            "GR: no effective edition folder answered (probed the last 3 "
            "AIRAC cycles x AMDT 01-13)"
        )

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = HOST
        last_html: str | None = None

        try:
            # Locate the effective edition's side menu (static folder probe -
            # the menu carries every publication as a direct PDF link).
            menu_url, menu_html = self._find_current_edition()
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
                key = m3.group(1).upper()
                if key in heli_seen:
                    continue
                heli_seen.add(key)
                # Heliports are place-name only (no ICAO). Prefer the menu link
                # text ("AD 3.2 AGIOS EFSTRATIOS" -> "AGIOS EFSTRATIOS"); fall
                # back to the href key with hyphens rendered as spaces.
                name = (
                    _AD3_TITLE_PREFIX_RE.sub("", text).strip()
                    or key.replace("-", " ")
                )
                heliports.append(
                    Airport(
                        country=self.country,
                        icao=None,
                        title=name,
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
            # Title convention "<name> <ICAO>" (list / map / detail heading);
            # the menu carries no AD 2 name, so use the static _NAMES map with a
            # bare-ICAO fallback for an unmapped field.
            name = _NAMES.get(icao, "")
            title = f"{name} {icao}" if name else icao
            airports.append(
                Airport(
                    country=self.country,
                    icao=icao,
                    title=title,
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
        # Diagnostic: if no heliports matched, log the AD-3-ish hrefs so the
        # real path/naming is visible without another blind runner round.
        if not heliports:
            ad3ish = []
            for a in soup.find_all("a", href=True):
                h = unquote(a["href"])
                if re.search(r"AD[ _]?3", h, re.I) and ".pdf" in h.lower():
                    ad3ish.append(h)
            self.logger.warning(
                f"GR: 0 heliports matched; {len(ad3ish)} AD-3-ish pdf hrefs, "
                f"first 12: {ad3ish[:12]}"
            )
        return airports
