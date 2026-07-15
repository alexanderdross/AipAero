"""Bosnia and Herzegovina (BHANSA) eAIP crawler.

Source: BHANSA publishes a standard eurocontrol frameset eAIP at
`eaip.bhansa.gov.ba`. The root page lists the AIRAC editions via JS, but each
edition lives at a deterministic, date-stamped path:

    https://eaip.bhansa.gov.ba/<YYYY-MM-DD>-AIRAC/html/index.html

so this crawler skips the JS root and builds the currently effective edition
URL straight from the AIRAC 28-day schedule (probing recent cycles until one
answers), then walks the frame chain to the navigation menu.

BHANSA's menu has NO aggregate "AD 2" div: every field is its own top-level
chapter (id "AD-2.<ICAO>details" / "AD-4.<ICAO>details"), the per-chapter
layout CZ/PT/HU/IE use. AD 2 carries the 4 international aerodromes (LQBK/LQMO/
LQSA/LQTZ); AD 4 carries the ~13 smaller VFR fields (the bulk of the country -
the Slovenia pattern). All are emitted as "vfr", deduped by ICAO. Pure HTML -
no JS/browser, no login. LQ is the Bosnia ICAO prefix.
"""

import datetime
import re

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "BA"
HOST = "https://eaip.bhansa.gov.ba/"
# A known AIRAC effective date to anchor the fixed 28-day cycle.
_AIRAC_ANCHOR = datetime.date(2026, 7, 9)

# Per-chapter menu ids: "AD-2.<ICAO>details" (international aerodromes) and
# "AD-4.<ICAO>details" (small VFR fields). Group 1 is the ICAO code.
_AD2_CHAPTER_RE = re.compile(r"AD[ -]2\.([A-Z]{4}).*details$")
_AD4_CHAPTER_RE = re.compile(r"AD[ -]4\.([A-Z]{4}).*details$")


class BA(HttpEurocontrolBase):
    """Bosnia and Herzegovina (BHANSA) AIP crawler - standard eurocontrol eAIP.

    The current edition URL is derived from the AIRAC schedule (the JS root page
    is bypassed), then the frame chain is walked to the navigation HTML and the
    per-airport AD 2 / AD 4 chapters are read.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    @staticmethod
    def airac_dates_on_or_before(
        today: datetime.date, count: int = 3
    ) -> list[datetime.date]:
        """The ``count`` most recent AIRAC effective dates on/before ``today``
        (fixed global 28-day cycle), newest first."""
        k = (today - _AIRAC_ANCHOR).days // 28
        return [
            _AIRAC_ANCHOR + datetime.timedelta(days=28 * (k - i))
            for i in range(count)
        ]

    def _resolve_edition_index(
        self, today: datetime.date | None = None
    ) -> str:
        """Return the currently effective edition's index.html URL.

        Builds `<date>-AIRAC/html/index.html` for recent AIRAC cycles (newest
        first) and returns the first that answers 200. No retries on a miss so
        a 404 is one quick request.
        """
        today = today or datetime.date.today()
        saved_retries = self.max_retries
        self.max_retries = 1
        try:
            for wef in self.airac_dates_on_or_before(today, count=3):
                url = f"{HOST}{wef.isoformat()}-AIRAC/html/index.html"
                try:
                    self.fetch(url)
                except Exception:
                    continue
                self.logger.info(
                    f"BA current edition index (AIRAC {wef.isoformat()}): {url}"
                )
                return url
        finally:
            self.max_retries = saved_retries
        raise ValueError(
            "BA: no effective edition index answered (probed the last 3 "
            "AIRAC cycles)"
        )

    # Chart-PDF extraction: BHANSA's AD 2.24 charts follow the eurocontrol
    # positional scheme LQ_AD_2_<ICAO>_24-<n>_en.pdf (sheet 24-1 = the
    # aerodrome chart). Prefer sheet 24-1, else the first chart on the page.
    FETCH_PDF_URLS = True
    PDF_HREF_PRIORITY = (r"_24[-_]1_en\.pdf$",)

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = HOST
        last_html: str | None = None

        try:
            # 1. Currently effective edition index (AIRAC-derived, no JS root).
            index_url = self._resolve_edition_index()

            # 2. Walk the frame chain to the navigation HTML. BHANSA's frameset
            # is flat (index -> eAISNavigation directly), not the two-level
            # eAISNavigationBase -> eAISNavigation chain some eAIPs use.
            nav_url, nav_html = self.follow_frame_chain(
                index_url, ["eAISNavigation"]
            )
            last_url, last_html = nav_url, nav_html

            # 3. Aerodromes: no aggregate AD 2 section - each field is its own
            # "AD-2.<ICAO>details" / "AD-4.<ICAO>details" chapter. AD 2 = the
            # international aerodromes, AD 4 = the small VFR fields. All "vfr".
            airports.extend(
                self.extract_airports_per_chapter(
                    nav_html, nav_url, _AD2_CHAPTER_RE, "vfr"
                )
            )
            try:
                airports.extend(
                    self.extract_airports_per_chapter(
                        nav_html, nav_url, _AD4_CHAPTER_RE, "vfr"
                    )
                )
            except ValueError:
                self.logger.info("BA: no AD 4 section - skipping")

            # Dedup by ICAO (a field must not appear twice if listed in both
            # AD 2 and AD 4); keep the first (AD 2) occurrence.
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
            self.logger.error(f"BA crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
