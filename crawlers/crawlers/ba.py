"""Bosnia and Herzegovina (BHANSA) eAIP crawler.

Source: BHANSA publishes a standard eurocontrol frameset eAIP at
`eaip.bhansa.gov.ba`. The root page lists the AIRAC editions via JS, but each
edition lives at a deterministic, date-stamped path:

    https://eaip.bhansa.gov.ba/<YYYY-MM-DD>-AIRAC/html/index.html

so this crawler skips the JS root and builds the currently effective edition
URL straight from the AIRAC 28-day schedule (probing recent cycles until one
answers), then walks the frame chain to the navigation menu and reads AD 2
(aerodromes) / AD 3 (heliports). Pure HTML - no JS/browser, no login. LQ is the
Bosnia ICAO prefix.
"""

import datetime

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "BA"
HOST = "https://eaip.bhansa.gov.ba/"
# A known AIRAC effective date to anchor the fixed 28-day cycle.
_AIRAC_ANCHOR = datetime.date(2026, 7, 9)

# eurocontrol menu ids vary by generator/locale; try the spaced locale-suffixed
# form and the hyphenated short form.
_AD2_SECTION_IDS = ["AD 2en-GBdetails", "AD-2details"]
_AD3_SECTION_IDS = ["AD 3en-GBdetails", "AD-3details"]


class BA(HttpEurocontrolBase):
    """Bosnia and Herzegovina (BHANSA) AIP crawler - standard eurocontrol eAIP.

    The current edition URL is derived from the AIRAC schedule (the JS root page
    is bypassed), then the frame chain is walked to the navigation HTML.
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

    def _extract_section(
        self,
        nav_html: str,
        nav_url: str,
        id_candidates: list[str],
        category: str,
    ) -> list[Airport]:
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

    # Chart-PDF extraction refined from the first live run's pdf_url coverage.
    FETCH_PDF_URLS = True

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

            # 3. Aerodromes (AD 2) and heliports (AD 3, fail-soft if absent).
            airports.extend(
                self._extract_section(nav_html, nav_url, _AD2_SECTION_IDS, "vfr")
            )
            try:
                airports.extend(
                    self._extract_section(
                        nav_html, nav_url, _AD3_SECTION_IDS, "heliport"
                    )
                )
            except ValueError as e:
                self.logger.info(f"BA: no AD 3 heliport section ({e})")

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
