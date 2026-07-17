"""Georgia (Sakaeronavigatsia) eAIP crawler.

Source: Georgia publishes a standard, OPEN eurocontrol frameset eAIP at
`airnav.ge/eaip/` (no login, no proxy). The edition history page lists every
issue, each at a date-stamped path:

    https://airnav.ge/eaip/<YYYY-MM-DD>-000000/html/index-en-GB.html

(older archives use a `-AIRAC` suffix instead of `-000000`). This crawler reads
the effective date out of each edition path on `history-en-GB.html`, picks the
one in effect today, and fetches the navigation menu frame directly
(`.../html/eAIP/UG-menu-en-GB.html` - the classic 3-frame eurocontrol layout,
deterministic path, no frame-name walk). AD 2 aerodromes are read with an
aggregate-section then per-chapter fallback (the AL/SI pattern), all "vfr";
AD 3 heliports are optional and fail-soft. Pure HTML, no JS/browser, no login.

Charts: Georgia's AD 2.24 chart PDFs live under the edition's `html/graphics/`
folder and are named `<ICAO>-<TYPE>-<seq>.pdf` (TYPE = VAC / ADC / IAC-...),
NOT the eurocontrol positional `_24-1_` scheme - so PDF_HREF_PRIORITY prefers
`-VAC-` then `-ADC-`. UG is the Georgia ICAO prefix.
"""

import csv
import datetime
import io
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "GE"
# The eAIP edition-history page: lists every issue's index, each a dated folder.
ROOT_URL = "https://airnav.ge/eaip/history-en-GB.html"

# OurAirports airports export (CC0 / public domain) - used only to enrich the
# aerodrome NAME. airnav.ge's AD-2 menu labels each chapter with the bare ICAO
# (no place name), but the site's hard rule is titles must read "<name> <ICAO>"
# (map label / list / detail heading), so the name is looked up here.
AIRPORTS_CSV = "https://davidmegginson.github.io/ourairports-data/airports.csv"

# Edition folders embed their effective date as `<YYYY-MM-DD>-000000` (current
# scheme) or `<YYYY-MM-DD>-AIRAC` (older archives); both sit above `/html`.
_EDITION_RE = re.compile(r"(\d{4})-(\d{2})-(\d{2})-(?:000000|AIRAC)/html", re.I)

# Menu frame (the nav tree) sits under the edition's html/eAIP/ folder.
_MENU_SUFFIX = "eAIP/UG-menu-en-GB.html"

# Aggregate AD 2 / AD 3 menu-section id variants (tried in order), then the
# per-airport chapter fallback ("AD <n>.<ICAO>...details", CZ/PT/IE layout).
_AD2_SECTION_IDS = ["AD 2en-GBdetails", "AD-2details", "AD 2details"]
_AD3_SECTION_IDS = ["AD 3en-GBdetails", "AD-3details", "AD 3details"]
# airnav.ge keys each aerodrome chapter as `iAD-2-<ICAO>details` - a HYPHEN
# between "2" and the ICAO (not the "AD 2.<ICAO>" dot other eAIPs use), and no
# aggregate "AD 2" container, so only the per-chapter fallback matches. Accept
# both separators ([-.]) so the regex is robust across editions.
_AD2_CHAPTER_RE = re.compile(r"AD[ -]2[-.]([A-Z]{4}).*details$")
_AD3_CHAPTER_RE = re.compile(r"AD[ -]3[-.]([A-Z0-9]{3,4}).*details$")


class GE(HttpEurocontrolBase):
    """Georgia (Sakaeronavigatsia) AIP crawler - standard eurocontrol eAIP.

    The current edition is picked by date from the eAIP history page, then the
    menu frame is fetched directly (deterministic path) and AD 2 read.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _resolve_menu_url(
        self, html: str, today: datetime.date | None = None
    ) -> str:
        """Return the currently effective edition's navigation-menu URL.

        Reads the effective date out of each edition path and picks the latest
        edition on/before ``today`` (earliest if, unexpectedly, all are in the
        future), then points at that edition's `eAIP/UG-menu-en-GB.html`.
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
                f"GE: no eAIP edition links found in {ROOT_URL}. Hrefs: {hrefs}"
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
            f"GE current edition (effective {eff.isoformat()}): {menu_url}"
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
        """ICAO -> aerodrome name for Georgia, from OurAirports (CC0). Fail-soft
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
            self.logger.warning(f"GE: OurAirports name lookup failed ({e})")
            return {}

    # Chart-PDF extraction: Georgia's AD 2.24 charts sit under the edition's
    # `pdf/` folder as `UG-AD-2-<ICAO>-<Chart-name>.pdf` (Visual approach /
    # Aerodrome chart / instrument approaches). Prefer the visual approach, then
    # the aerodrome chart, as the primary; the base falls back to the first
    # chart if neither token is present, so coverage stays complete.
    FETCH_PDF_URLS = True
    PDF_HREF_PRIORITY = (r"Visual-approach", r"Aerodrome-chart")

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
                    f"GE: aggregate AD 2 parse failed ({e}); "
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
                    self.logger.info("GE: no AD 3 heliport section - skipping")

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

            # Enrich the NAME: airnav.ge's menu labels each chapter with the
            # bare ICAO, so upgrade "<ICAO>" -> "<name> <ICAO>" from OurAirports
            # (CC0). Only override a bare-ICAO title, never a real eAIP name.
            names = self._ourairports_names()
            for a in airports:
                if a.icao and a.title.strip().upper() == a.icao and (
                    name := names.get(a.icao)
                ):
                    a.title = f"{name} {a.icao}"

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"GE crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
