"""Kazakhstan (Kazaeronavigatsia) eAIP crawler.

Source: Kazakhstan publishes a standard, OPEN eurocontrol frameset eAIP at
`ans.kz` (no login, no proxy). The AIS landing page (`ans.kz/en/ais/eaip`) lists
every current/upcoming edition, each at a date-stamped path:

    https://www.ans.kz/AIP/eAIP/<YYYY-MM-DD>-AIRAC/html/index-en-GB.html

This crawler reads the effective date out of each edition path on the landing
page, picks the one in effect today, and fetches the navigation menu frame
directly (`.../html/eAIP/UA-menu-en-GB.html` - the classic 3-frame eurocontrol
layout; UA is the Kazakhstan AIP document prefix, matching the ICAO UA** region).
AD 2 aerodromes are read with an aggregate-section then per-chapter fallback (the
AL/GE pattern), all "vfr". Pure HTML, no JS/browser, no login.
"""

import csv
import datetime
import io
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "KZ"
# The AIS eAIP landing page: lists every edition's index, each a dated folder.
ROOT_URL = "https://www.ans.kz/en/ais/eaip"

# OurAirports airports export (CC0 / public domain) - used only to enrich the
# aerodrome NAME when the eAIP menu labels a chapter with the bare ICAO.
AIRPORTS_CSV = "https://davidmegginson.github.io/ourairports-data/airports.csv"

# Edition folders embed their effective date as `<YYYY-MM-DD>-AIRAC`, above
# `/html`; e.g. `/AIP/eAIP/2026-07-09-AIRAC/html/index-en-GB.html`.
_EDITION_RE = re.compile(r"(\d{4})-(\d{2})-(\d{2})-AIRAC/html", re.I)

# Menu frame (the nav tree) sits under the edition's html/eAIP/ folder.
_MENU_SUFFIX = "eAIP/UA-menu-en-GB.html"

# Aggregate AD 2 menu-section id variants (tried in order), then the per-airport
# chapter fallback ("AD 2.<ICAO>...details", CZ/GE layout).
_AD2_SECTION_IDS = ["AD 2en-GBdetails", "AD-2details", "AD 2details"]
_AD2_CHAPTER_RE = re.compile(r"AD[ -]2[-.]([A-Z]{4}).*details$")
_AD3_SECTION_IDS = ["AD 3en-GBdetails", "AD-3details", "AD 3details"]
_AD3_CHAPTER_RE = re.compile(r"AD[ -]3[-.]([A-Z0-9]{3,4}).*details$")


class KZ(HttpEurocontrolBase):
    """Kazakhstan (Kazaeronavigatsia) AIP crawler - standard eurocontrol eAIP.

    The current edition is picked by date from the AIS landing page, then the
    menu frame is fetched directly (deterministic path) and AD 2 read.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _resolve_menu_url(
        self, html: str, today: datetime.date | None = None
    ) -> str:
        """Return the currently effective edition's navigation-menu URL.

        Reads the effective date out of each edition path and picks the latest
        edition on/before ``today`` (earliest if all are in the future).
        """
        today = today or datetime.date.today()
        soup = self.soup(html)
        candidates: list[tuple[datetime.date, str]] = []
        seen: set[str] = set()
        for a in soup.find_all("a", href=True):
            m = _EDITION_RE.search(a["href"])
            if not m:
                continue
            try:
                eff = datetime.date(*(int(g) for g in m.groups()))
            except ValueError:
                continue
            # Edition root is everything up to and including `.../html`.
            root = urljoin(ROOT_URL, a["href"][: m.end()])
            if root in seen:
                continue
            seen.add(root)
            candidates.append((eff, root))

        if not candidates:
            hrefs = [a["href"][:100] for a in soup.find_all("a", href=True)][:40]
            raise ValueError(
                f"KZ: no eAIP edition links found in {ROOT_URL}. Hrefs: {hrefs}"
            )

        in_effect = [c for c in candidates if c[0] <= today]
        eff, root = (
            max(in_effect, key=lambda c: c[0])
            if in_effect
            else min(candidates, key=lambda c: c[0])
        )
        menu_url = urljoin(root.rstrip("/") + "/", _MENU_SUFFIX)
        # Forward the effective edition to crawl_meta.airac so the detail page
        # shows the AIRAC (the chart URLs may carry no parseable date).
        self.airac = eff.isoformat()
        self.logger.info(
            f"KZ current edition (effective {eff.isoformat()}): {menu_url}"
        )
        return menu_url

    def _extract_section(
        self,
        nav_html: str,
        nav_url: str,
        id_candidates: list[str],
        category: str,
    ) -> list[Airport]:
        """Extract a menu section, trying each candidate id format in turn."""
        last_error: Exception | None = None
        for menu_id in id_candidates:
            try:
                return self.extract_airports_from_html(
                    nav_html, nav_url, menu_id, category  # type: ignore[arg-type]
                )
            except ValueError as e:
                last_error = e
        assert last_error is not None
        raise last_error

    def _ourairports_names(self) -> dict[str, str]:
        """ICAO -> aerodrome name for Kazakhstan, from OurAirports (CC0).
        Fail-soft to an empty map (titles then stay whatever the eAIP gave)."""
        try:
            resp = self.client.get(AIRPORTS_CSV, timeout=60)
            resp.raise_for_status()
            names: dict[str, str] = {}
            for row in csv.DictReader(io.StringIO(resp.text)):
                if (row.get("iso_country") or "").strip().upper() != COUNTRY:
                    continue
                for key in ("icao_code", "ident"):
                    code = (row.get(key) or "").strip().upper()
                    if len(code) == 4 and code.isalpha():
                        name = (row.get("name") or "").strip()
                        if name:
                            names.setdefault(code, name)
                        break
            return names
        except Exception as e:
            self.logger.warning(f"KZ: OurAirports name lookup failed ({e})")
            return {}

    # Chart-PDF extraction (Stage 2). Kazakhstan's AD 2.24 chart naming is not
    # yet confirmed from a pdf_recon run, so prefer the common visual/aerodrome
    # tokens and let the base fall back to the first chart otherwise (so
    # coverage stays complete). Refine PDF_HREF_PRIORITY after a live pdf_recon.
    FETCH_PDF_URLS = True
    PDF_HREF_PRIORITY = (r"VAC", r"ADC", r"Visual", r"Aerodrome")

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. AIS landing page -> currently effective edition's menu frame.
            landing = self.fetch(ROOT_URL)
            last_html = landing
            menu_url = self._resolve_menu_url(landing)

            # 2. Fetch the nav menu directly (deterministic eurocontrol path).
            nav_html = self.fetch(menu_url)
            last_url, last_html = menu_url, nav_html

            # 3. AD 2 aerodromes (aggregate section, per-chapter fallback), vfr.
            try:
                airports.extend(
                    self._extract_section(
                        nav_html, menu_url, _AD2_SECTION_IDS, "vfr"
                    )
                )
            except ValueError as e:
                self.logger.warning(
                    f"KZ: aggregate AD 2 parse failed ({e}); "
                    "trying per-airport chapters"
                )
                airports.extend(
                    self.extract_airports_per_chapter(
                        nav_html, menu_url, _AD2_CHAPTER_RE, "vfr"
                    )
                )

            # 4. AD 3 heliports (optional, fail-soft).
            try:
                airports.extend(
                    self._extract_section(
                        nav_html, menu_url, _AD3_SECTION_IDS, "heliport"
                    )
                )
            except ValueError:
                try:
                    airports.extend(
                        self.extract_airports_per_chapter(
                            nav_html, menu_url, _AD3_CHAPTER_RE, "heliport"
                        )
                    )
                except ValueError:
                    self.logger.info("KZ: no AD 3 heliport section - skipping")

            # Dedup by ICAO (keep first occurrence).
            seen_icao: set[str] = set()
            deduped: list[Airport] = []
            for a in airports:
                key = (a.icao or a.title or "").upper()
                if key in seen_icao:
                    continue
                seen_icao.add(key)
                deduped.append(a)
            airports = deduped

            # Enrich the NAME when the menu labelled a chapter with the bare
            # ICAO: upgrade "<ICAO>" -> "<name> <ICAO>" from OurAirports (CC0).
            names = self._ourairports_names()
            for a in airports:
                if a.icao and a.title.strip().upper() == a.icao and (
                    name := names.get(a.icao)
                ):
                    a.title = f"{name} {a.icao}"

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"KZ crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
