import datetime
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "UK"
ROOT_URL = "https://nats-uk.ead-it.com/cms-nats/opencms/en/Publications/AIP/"

# The publications landing page lists several AIRAC editions side by side
# (current + the next 28/56-day AMDTs), each linking to an online eAIP at
# `.../Publications/YYYY-MM-DD-AIRAC/html/index-en-GB.html`. There is no
# "current" label — NATS explicitly notes the links are dynamic and change
# every cycle — so we read the AIRAC effective date straight out of each URL
# and pick the latest edition that is already in effect today.
_AIRAC_EDITION_RE = re.compile(r"/(\d{4})-(\d{2})-(\d{2})-AIRAC/html/index", re.I)

# eurocontrol menu ids differ between AIPs: IDS-generated eAIPs (LVNL, NATS)
# use spaced, locale-suffixed ids ("AD 2en-GBdetails"); others use the
# hyphenated short form ("AD-2details"). Try both so a menu-format tweak on
# NATS' side doesn't silently empty the list.
_AD2_SECTION_IDS = ["AD 2en-GBdetails", "AD-2details"]
_AD3_SECTION_IDS = ["AD 3en-GBdetails", "AD-3details"]


class UK(HttpEurocontrolBase):
    """United Kingdom AIP crawler.

    NATS UK serves the standard eurocontrol frameset eAIP. The publications
    landing page offers the current plus the next one/two AIRAC editions;
    each "Online Version" link embeds its AIRAC effective date in the URL
    (`.../YYYY-MM-DD-AIRAC/html/index-en-GB.html`). We select the currently
    effective edition by date, then walk the frame chain to the navigation
    HTML — no JS/browser needed.
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

        Reads the AIRAC effective date out of each online-version URL and
        returns the latest edition whose date is on or before ``today``
        (falling back to the earliest listed edition if — unexpectedly —
        every edition is still in the future).
        """
        today = today or datetime.date.today()
        soup = self.soup(html)

        candidates: list[tuple[datetime.date, str]] = []
        for a in soup.find_all("a", href=True):
            m = _AIRAC_EDITION_RE.search(a["href"])
            if not m:
                continue
            year, month, day = (int(g) for g in m.groups())
            try:
                effective = datetime.date(year, month, day)
            except ValueError:
                continue
            candidates.append((effective, urljoin(base_url, a["href"])))

        if not candidates:
            raise ValueError(
                f"No AIRAC eAIP 'Online Version' links found in {base_url}"
            )

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

    # Chart-PDF extraction (recon 2026-07-12): chart links are labelled
    # "AD 2.EGPD-2-1" (2-1 = aerodrome chart); small fields have only that one.
    FETCH_PDF_URLS = True
    PDF_TEXT_PRIORITY = (r"AD 2\.\w{4}-2-1$",)

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. Landing page → currently effective AIRAC edition (by date).
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
            airports.extend(
                self._extract_section(
                    nav_html, nav_url, _AD3_SECTION_IDS, "heliport"
                )
            )

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"UK crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
