"""Albania (Albcontrol) eAIP crawler.

Source: Albcontrol publishes a standard eurocontrol frameset eAIP, linked from
`www.albcontrol.al/aip/`. That landing page lists the editions side by side,
each a dated path:

    /al/aip/<DD-MON-YYYY-[N]A>/<YYYY-MM-DD>-(AIRAC|NON-AIRAC)/html/

This crawler reads the effective date out of each edition path, picks the one
in effect today, and fetches the navigation menu frame directly
(`.../html/eAIP/LA-menu-en-GB.html` - the classic 3-frame eurocontrol layout,
so the menu URL is deterministic and no frame-name walk is needed). AD 2
aerodromes are read with an aggregate-section then per-chapter fallback (the
SI pattern), all "vfr"; AD 3 heliports are optional and fail-soft. Pure HTML,
no JS/browser, no login. LA is the Albania ICAO prefix.
"""

import datetime
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "AL"
ROOT_URL = "https://www.albcontrol.al/aip/"

# Edition links embed their AIRAC effective date in the path as
# `.../<YYYY-MM-DD>-(AIRAC|NON-AIRAC)/html`. Capture the date to pick the
# currently effective edition.
_EDITION_RE = re.compile(
    r"/al/aip/[^/]+/(\d{4})-(\d{2})-(\d{2})-(?:NON-)?AIRAC/html", re.I
)

# Menu frame (the nav tree) sits under the edition's html/eAIP/ folder.
_MENU_SUFFIX = "eAIP/LA-menu-en-GB.html"

# Aggregate AD 2 / AD 3 menu-section id variants (tried in order), then the
# per-airport chapter fallback ("AD <n>.<ICAO>...details", CZ/PT/IE layout).
_AD2_SECTION_IDS = ["AD 2en-GBdetails", "AD-2details", "AD 2details"]
_AD3_SECTION_IDS = ["AD 3en-GBdetails", "AD-3details", "AD 3details"]
_AD2_CHAPTER_RE = re.compile(r"AD[ -]2\.([A-Z]{4}).*details$")
_AD3_CHAPTER_RE = re.compile(r"AD[ -]3\.([A-Z0-9]{3,4}).*details$")


class AL(HttpEurocontrolBase):
    """Albania (Albcontrol) AIP crawler - standard eurocontrol eAIP.

    The current edition is picked by date from the `/aip/` landing page, then
    the menu frame is fetched directly (deterministic path) and AD 2 read.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _resolve_menu_url(
        self, html: str, today: datetime.date | None = None
    ) -> str:
        """Return the currently effective edition's navigation-menu URL.

        Reads the effective date out of each edition path and picks the latest
        edition on/before ``today`` (earliest if, unexpectedly, all are in the
        future), then points at that edition's `eAIP/LA-menu-en-GB.html`.
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
                f"AL: no eAIP edition links found in {ROOT_URL}. Hrefs: {hrefs}"
            )

        in_effect = [c for c in candidates if c[0] <= today]
        eff, root = (
            max(in_effect, key=lambda c: c[0])
            if in_effect
            else min(candidates, key=lambda c: c[0])
        )
        menu_url = urljoin(root.rstrip("/") + "/", _MENU_SUFFIX)
        self.logger.info(
            f"AL current edition (effective {eff.isoformat()}): {menu_url}"
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

    # Chart-PDF extraction: eurocontrol AD 2.24 charts follow the positional
    # scheme LA_AD_2_<ICAO>_24-<n>_en-GB.pdf; prefer the aerodrome sheet 24-1.
    FETCH_PDF_URLS = True
    PDF_HREF_PRIORITY = (r"_24[-_]1_en", r"_VAC_", r"_ADC_")

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
                    f"AL: aggregate AD 2 parse failed ({e}); "
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
                    self.logger.info("AL: no AD 3 heliport section - skipping")

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

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"AL crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
