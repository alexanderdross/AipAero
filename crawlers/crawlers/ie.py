"""Ireland (AirNav Ireland) eAIP crawler.

Source: the Irish ANSP rebranded from the IAA to **AirNav Ireland**, and its
aeronautical information now lives on `www.airnav.ie` (the old `iaip.iaa.ie`
host is retired - it answers modern TLS handshakes with a cipher mismatch).
The Aeronautical Information Management landing page lists several dated eAIP
editions side by side, each a standard eurocontrol frameset:

    .../aeronautical-information-management
        ├─ eAIP Ireland 14 MAY 2026  -> .../AIRAC_MAY_2026/2026-05-14-AIRAC/html/index.html
        ├─ eAIP Ireland 11 JUN 2026  -> .../AIRAC_JUNE_2026/2026-06-11-AIRAC/html/index.html
        └─ eAIP Ireland 09 JUL 2026  -> .../AIRAC/26-07-09-AIRAC/html/index.html   (newest)

Note the two URL shapes: older editions carry a four-digit year
(`2026-05-14-AIRAC`) under a month-name folder, the newest a two-digit year
(`26-07-09-AIRAC`) under a bare `AIRAC/` folder. This crawler reads the AIRAC
effective date out of each URL (tolerating both), picks the one in effect
today, walks the frame chain to the navigation menu, and reads AD 2
(aerodromes) / AD 3 (heliports). Pure HTML - no JS/browser, no login.
"""

import datetime
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "IE"
ROOT_URL = (
    "https://www.airnav.ie/air-traffic-management/"
    "aeronautical-information-management"
)

# Each "eAIP" link embeds its AIRAC effective date in the URL as
# `.../<YY|YYYY>-MM-DD-AIRAC/html/index...`. The year is two OR four digits
# (the newest edition drops to `26-07-09`, older ones keep `2026-05-14`), so
# accept 2-4 digits and normalise a two-digit year to 20xx.
_AIRAC_EDITION_RE = re.compile(r"/(\d{2,4})-(\d{2})-(\d{2})-AIRAC/html/index", re.I)

# eurocontrol menu ids vary by generator/locale: IDS-generated eAIPs use spaced,
# locale-suffixed ids ("AD 2en-GBdetails"); others the hyphenated short form
# ("AD-2details"). Try each so a menu-format/locale tweak doesn't empty the list.
_AD2_SECTION_IDS = ["AD 2en-GBdetails", "AD 2en-IEdetails", "AD-2details"]
_AD3_SECTION_IDS = ["AD 3en-GBdetails", "AD 3en-IEdetails", "AD-3details"]


class IE(HttpEurocontrolBase):
    """Ireland (AirNav Ireland) AIP crawler.

    AirNav Ireland serves the standard eurocontrol frameset eAIP. The AIM
    landing page offers the current plus the next AIRAC edition(s); each link
    embeds its AIRAC effective date in the URL. We select the currently
    effective edition by date, then walk the frame chain to the navigation
    HTML - no JS/browser needed.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _resolve_current_edition_url(
        self,
        base_url: str,
        html: str,
        today: datetime.date | None = None,
    ) -> str:
        """Pick the currently effective AIRAC edition from the landing page.

        Reads the AIRAC effective date out of each eAIP URL (two- or
        four-digit year) and returns the latest edition whose date is on or
        before ``today`` (falling back to the earliest listed edition if,
        unexpectedly, every edition is still in the future).
        """
        today = today or datetime.date.today()
        soup = self.soup(html)

        # Collect (effective_date, absolute_url) for each dated edition link.
        candidates: list[tuple[datetime.date, str]] = []
        for a in soup.find_all("a", href=True):
            m = _AIRAC_EDITION_RE.search(a["href"])
            if not m:
                continue
            year, month, day = (int(g) for g in m.groups())
            # Normalise a two-digit year (26 -> 2026); leave four-digit as-is.
            if year < 100:
                year += 2000
            try:
                effective = datetime.date(year, month, day)
            except ValueError:
                # Impossible calendar date in the href - ignore this link.
                continue
            candidates.append((effective, urljoin(base_url, a["href"])))

        if not candidates:
            raise ValueError(
                f"No AIRAC eAIP edition links found in {base_url}"
            )

        # Latest edition already in effect; else the earliest listed one.
        in_effect = [c for c in candidates if c[0] <= today]
        effective_date, edition_url = (
            max(in_effect, key=lambda c: c[0])
            if in_effect
            else min(candidates, key=lambda c: c[0])
        )
        self.logger.info(
            f"Current AIRAC edition (effective {effective_date.isoformat()}): "
            f"{edition_url}"
        )
        return edition_url

    def _extract_section(
        self,
        nav_html: str,
        nav_url: str,
        id_candidates: list[str],
        category: str,
    ) -> list[Airport]:
        """Extract a menu section, trying each candidate id format in turn.

        Returns the first id that yields airports, re-raising the last error
        if none matched.
        """
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

    # Chart-PDF extraction: eurocontrol eAIPs label the aerodrome chart
    # "AD 2.EIDW-2-1"; prefer it, else the first PDF on the page (fail-soft).
    # Refined from the pdf_url coverage of the first live IE run.
    FETCH_PDF_URLS = True
    PDF_TEXT_PRIORITY = (r"AD 2\.\w{4}-2-1$",)

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. Landing page -> currently effective AIRAC edition (by date).
            landing_html = self.fetch(ROOT_URL)
            last_url, last_html = ROOT_URL, landing_html

            edition_url = self._resolve_current_edition_url(ROOT_URL, landing_html)

            # 2. Walk the frame chain to the navigation HTML.
            nav_url, nav_html = self.follow_frame_chain(
                edition_url, ["eAISNavigationBase", "eAISNavigation"]
            )
            last_url, last_html = nav_url, nav_html

            # 3. Aerodromes (AD 2) and heliports (AD 3).
            airports.extend(
                self._extract_section(nav_html, nav_url, _AD2_SECTION_IDS, "vfr")
            )
            # AD 3 (heliports) may be absent in a small state's eAIP - fail-soft.
            try:
                airports.extend(
                    self._extract_section(
                        nav_html, nav_url, _AD3_SECTION_IDS, "heliport"
                    )
                )
            except ValueError as e:
                self.logger.info(f"IE: no AD 3 heliport section ({e})")

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"IE crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
