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

# AirNav Ireland's eAIP has NO aggregate "AD 2" menu section: every aerodrome
# is its own top-level chapter, id "AD-2.EIDWdetails" (group 1 = the ICAO). This
# is the per-chapter layout CZ/PT/HU/IS use, not the aggregate one NL/UK use.
_AIRPORT_SECTION_RE = re.compile(r"AD-2\.([A-Z]{4})details$")


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

            # 2. Walk the frame chain to the navigation HTML. AirNav Ireland's
            # index.html is a FLAT frameset (eAISCommands / eAISNavigation /
            # eAISContent) - the menu is the eAISNavigation frame directly, not
            # the two-level eAISNavigationBase->eAISNavigation chain NL/UK use.
            nav_url, nav_html = self.follow_frame_chain(
                edition_url, ["eAISNavigation"]
            )
            last_url, last_html = nav_url, nav_html

            # 3. Aerodromes: each is its own "AD-2.<ICAO>details" chapter.
            # AirNav Ireland's eAIP has no separate AD 3 heliport section.
            airports.extend(
                self.extract_airports_per_chapter(
                    nav_html, nav_url, _AIRPORT_SECTION_RE, "vfr"
                )
            )

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
