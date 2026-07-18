"""Kosovo (ASHNA / CAA Kosovo) eAIP crawler.

Source: Kosovo publishes a standard, OPEN eurocontrol frameset eAIP at
`kans-ks.org` (also reachable via `ashna-ks.org`, which redirects there; no login,
no proxy). The edition-history page (`/eAIP/default.html`) lists every issue, each
in a date-stamped folder whose href is irregular - it contains a SPACE and a
Windows BACKSLASH before `index.html`, e.g.:

    /eAIP/AIRAC AMDT 07-2026_2026_07_09\\index.html

so the crawler reads the effective date from the trailing `_YYYY_MM_DD`, picks the
edition in effect today, URL-encodes the folder name (space -> %20, backslash ->
`/`), and fetches the navigation menu frame directly at
`<edition>/eAIP/menu.html` (the frame chain is index.html -> toc-frameset.html ->
eAIP/menu.html). AD 2 aerodromes are read with an aggregate-section then
per-chapter fallback (the GE/KZ pattern), all "vfr". BK is the Kosovo ICAO prefix
(BKPR Pristina is the single civil aerodrome). Pure HTML, no JS/browser, no login.
"""

import csv
import datetime
import io
import re
from urllib.parse import quote, urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "XK"
# The eAIP edition-history page: lists every issue's index (dated folders).
ROOT_URL = "https://kans-ks.org/eAIP/default.html"

# OurAirports airports export (CC0 / public domain) - used only to enrich the
# aerodrome NAME when the eAIP menu labels a chapter with the bare ICAO.
AIRPORTS_CSV = "https://davidmegginson.github.io/ourairports-data/airports.csv"

# Editions live in folders named like `AIRAC AMDT 07-2026_2026_07_09` (also
# `AIP AMDT NN-YYYY_...`, `A 02-2025_...`); the effective date is the trailing
# `_YYYY_MM_DD` immediately before the `\index.html` / `/index.html` file. The
# href uses a literal backslash and un-encoded spaces.
_EDITION_RE = re.compile(r"_(\d{4})_(\d{2})_(\d{2})[\\/]index\.html", re.I)

# Menu frame (the nav tree) sits under the edition's eAIP/ folder.
_MENU_SUFFIX = "eAIP/menu.html"

# Aggregate AD 2 menu-section id variants (tried in order), then the per-airport
# chapter fallback ("AD 2.<ICAO>...details", GE/KZ layout).
_AD2_SECTION_IDS = ["AD 2en-GBdetails", "AD-2details", "AD 2details"]
_AD2_CHAPTER_RE = re.compile(r"AD[ -]2[-.]([A-Z]{4}).*details$")
_AD3_SECTION_IDS = ["AD 3en-GBdetails", "AD-3details", "AD 3details"]
_AD3_CHAPTER_RE = re.compile(r"AD[ -]3[-.]([A-Z0-9]{3,4}).*details$")


class XK(HttpEurocontrolBase):
    """Kosovo (CAA Kosovo / ASHNA) AIP crawler - standard eurocontrol eAIP.

    The current edition is picked by date from the eAIP history page (folder
    names carry a space + backslash, so they are URL-encoded), then the menu
    frame is fetched directly and AD 2 read.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _resolve_menu_url(
        self, html: str, today: datetime.date | None = None
    ) -> str:
        """Return the currently effective edition's navigation-menu URL.

        Reads the effective date out of each edition href (the trailing
        `_YYYY_MM_DD`) and picks the latest edition on/before ``today``
        (earliest if all are in the future). The folder name contains a space
        and a backslash, both of which are normalised/encoded for the request.
        """
        today = today or datetime.date.today()
        soup = self.soup(html)
        candidates: list[tuple[datetime.date, str]] = []
        seen: set[str] = set()
        for a in soup.find_all("a", href=True):
            href = a["href"]
            m = _EDITION_RE.search(href)
            if not m:
                continue
            try:
                eff = datetime.date(*(int(g) for g in m.groups()))
            except ValueError:
                continue
            # Folder = everything before the `\index.html` / `/index.html` file;
            # normalise the backslash to a forward slash, then percent-encode.
            folder = re.split(r"[\\/]index\.html", href, maxsplit=1)[0]
            folder = folder.replace("\\", "/")
            menu_rel = quote(f"{folder}/{_MENU_SUFFIX}", safe="/")
            menu_url = urljoin(ROOT_URL, menu_rel)
            if menu_url in seen:
                continue
            seen.add(menu_url)
            candidates.append((eff, menu_url))

        if not candidates:
            hrefs = [a["href"][:100] for a in soup.find_all("a", href=True)][:40]
            raise ValueError(
                f"XK: no eAIP edition links found in {ROOT_URL}. Hrefs: {hrefs}"
            )

        in_effect = [c for c in candidates if c[0] <= today]
        eff, menu_url = (
            max(in_effect, key=lambda c: c[0])
            if in_effect
            else min(candidates, key=lambda c: c[0])
        )
        # Forward the effective edition to crawl_meta.airac so the detail page
        # shows the AIRAC (the chart URLs carry no parseable date of their own).
        self.airac = eff.isoformat()
        self.logger.info(
            f"XK current edition (effective {eff.isoformat()}): {menu_url}"
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
        """ICAO -> aerodrome name for Kosovo, from OurAirports (CC0). Fail-soft
        to an empty map (titles then stay whatever the eAIP gave)."""
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
            self.logger.warning(f"XK: OurAirports name lookup failed ({e})")
            return {}

    # Chart-PDF extraction (Stage 2). Kosovo AD 2.24 charts are named by chart
    # type (e.g. `IAC_ILS_or_LOC_RWY35.pdf`, a VAC/visual sheet); prefer the
    # visual/VAC sheet, else let the base fall back to the first chart so
    # coverage stays complete. Refine after a live pdf_recon if needed.
    FETCH_PDF_URLS = True
    PDF_HREF_PRIORITY = (r"VAC", r"Visual", r"VFR", r"ADC", r"Aerodrome")

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. Edition-history page -> currently effective edition's menu frame.
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
                    f"XK: aggregate AD 2 parse failed ({e}); "
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
                    self.logger.info("XK: no AD 3 heliport section - skipping")

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

            # Kosovo's aggregate AD 2 parse mislabels the aerodrome with a deep
            # AD-2 subsection heading (e.g. "AD 2.25 VISUAL SEGMENT SURFACE
            # (VSS) PENETRATION BKPR"), so the OurAirports place name is
            # authoritative here: override the title whenever OurAirports
            # resolves the ICAO (BKPR is Kosovo's single civil aerodrome). This
            # keeps the hard "<name> <ICAO>" title rule (map label / heading).
            names = self._ourairports_names()
            for a in airports:
                if a.icao and (name := names.get(a.icao)):
                    a.title = f"{name} {a.icao}"

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"XK crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
