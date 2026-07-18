"""Armenia (ARMATS) eAIP crawler.

Source: ARMATS publishes a standard, OPEN eurocontrol frameset eAIP. The eAIP
landing page lists every issue as a direct static link:

    https://armats.am/activities/ais/eaip
      -> /storage/attachments/<id>-<amdt>(<DDMONYYYY>)/index.html

Each edition folder embeds its effective date in the link as `(DDMONYYYY)`
(e.g. `(09JUL2026)`). This crawler reads the landing page, picks the edition in
effect today, and fetches the navigation menu frame directly
(`<edition>/html/eAIP/UD-menu-en-GB.html` - the classic 3-frame eurocontrol
layout, deterministic path). AD 2 aerodromes are read with an aggregate-section
then per-chapter fallback (the AL/GE pattern), all "vfr". Pure HTML, no
JS/browser, no login (the "Subscription Order Form" is a side channel; the
edition files themselves are open). UD is the Armenia ICAO prefix.

Names are enriched from OurAirports (CC0) when the menu labels a chapter with
the bare ICAO (the site's hard rule is titles must read "<name> <ICAO>").
"""

import csv
import datetime
import io
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "AM"
# The eAIP landing page: lists every edition as a dated static index.html link.
ROOT_URL = "https://armats.am/activities/ais/eaip"

# OurAirports airports export (CC0) - name enrichment for bare-ICAO chapters.
AIRPORTS_CSV = "https://davidmegginson.github.io/ourairports-data/airports.csv"

# Edition links embed their effective date as `(DDMONYYYY)` in the attachment
# path, e.g. `/storage/attachments/178126463302-26(09JUL2026)/index.html`.
# Capture the edition-folder path (group 1) and the date token (group 2).
_EDITION_RE = re.compile(
    r"(/storage/attachments/[^\"'()]+\((\d{2}[A-Z]{3}\d{4})\))/index\.html",
    re.I,
)

# Menu frame sits under the edition's html/eAIP/ folder.
_MENU_SUFFIX = "html/eAIP/UD-menu-en-GB.html"

# Aggregate AD 2 menu-section id variants (tried in order), then the per-airport
# chapter fallback ("AD 2.<ICAO>" dot form or "iAD-2-<ICAO>" hyphen form).
_AD2_SECTION_IDS = ["AD 2en-GBdetails", "AD-2details", "AD 2details"]
_AD2_CHAPTER_RE = re.compile(r"AD[ -]2[-.]([A-Z]{4}).*details$")


class AM(HttpEurocontrolBase):
    """Armenia (ARMATS) AIP crawler - standard eurocontrol eAIP.

    The current edition is picked by date from the eAIP landing page, then the
    menu frame is fetched directly (deterministic path) and AD 2 read.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _resolve_menu_url(
        self, html: str, today: datetime.date | None = None
    ) -> str:
        """Return the currently effective edition's navigation-menu URL.

        Reads the `(DDMONYYYY)` effective date out of each edition link and
        picks the latest edition on/before ``today`` (earliest if, unexpectedly,
        all are in the future), then points at its `html/eAIP/UD-menu-en-GB.html`.
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
                eff = datetime.datetime.strptime(m.group(2), "%d%b%Y").date()
            except ValueError:
                continue
            root = urljoin(ROOT_URL, m.group(1))
            if root in seen:
                continue
            seen.add(root)
            candidates.append((eff, root))

        if not candidates:
            hrefs = [a["href"][:100] for a in soup.find_all("a", href=True)][:40]
            raise ValueError(
                f"AM: no eAIP edition links found in {ROOT_URL}. Hrefs: {hrefs}"
            )

        in_effect = [c for c in candidates if c[0] <= today]
        eff, root = (
            max(in_effect, key=lambda c: c[0])
            if in_effect
            else min(candidates, key=lambda c: c[0])
        )
        menu_url = urljoin(root.rstrip("/") + "/", _MENU_SUFFIX)
        # Forward the effective edition to crawl_meta.airac so the detail page
        # shows the AIRAC (the chart URLs carry no parseable date of their own).
        self.airac = eff.isoformat()
        self.logger.info(
            f"AM current edition (effective {eff.isoformat()}): {menu_url}"
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
        """ICAO -> aerodrome name for Armenia, from OurAirports (CC0). Fail-soft
        to an empty map (the crawl still works, titles just stay bare ICAO)."""
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
            self.logger.warning(f"AM: OurAirports name lookup failed ({e})")
            return {}

    # Chart-PDF extraction: eurocontrol AD 2.24 charts follow the positional
    # scheme UD_AD_2_<ICAO>_24-<n>_en-GB.pdf; prefer the aerodrome sheet 24-1,
    # then a VAC/ADC token. The base falls back to the first chart otherwise.
    FETCH_PDF_URLS = True
    PDF_HREF_PRIORITY = (r"_24[-_]1_en", r"_VAC", r"_ADC", r"Visual", r"Aerodrome")

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. Landing page -> currently effective edition's menu frame.
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
                    f"AM: aggregate AD 2 parse failed ({e}); "
                    "trying per-airport chapters"
                )
                airports.extend(
                    self.extract_airports_per_chapter(
                        nav_html, menu_url, _AD2_CHAPTER_RE, "vfr"
                    )
                )

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

            # Enrich a bare-ICAO title -> "<name> <ICAO>" from OurAirports.
            names = self._ourairports_names()
            for a in airports:
                if a.icao and a.title.strip().upper() == a.icao and (
                    name := names.get(a.icao)
                ):
                    a.title = f"{name} {a.icao}"

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"AM crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
