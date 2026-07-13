import datetime
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "HU"
# HungaroControl lists dated AIRAC edition folders (probe_eaip run
# 29255990091): `/aip/2026-06-11/` (+ eaip.zip downloads). Pick the latest
# edition already in effect, then enter the eurocontrol frameset inside.
ROOT_URL = "https://ais-en.hungarocontrol.hu/aip/"

# Edition hrefs on the listing are RELATIVE ("2026-06-11/"), so the
# pattern must not require the "/aip/" path prefix (live run 29259975942
# found zero folders with the anchored variant). Matched against
# href.rstrip("/"); urljoin below resolves relative and absolute alike.
_EDITION_DATE_RE = re.compile(r"(?:^|/)(\d{4})-(\d{2})-(\d{2})$")
_INDEX_CANDIDATES = [
    "index-en-GB.html",
    "index.html",
    "html/index-en-GB.html",
    "html/index.html",
    "eAIP/html/index.html",
]

_AD2_SECTION_IDS = ["AD 2en-GBdetails", "AD-2details", "AD 2details"]
_AD3_SECTION_IDS = ["AD 3en-GBdetails", "AD-3details", "AD 3details"]

_FRAME_CHAINS = (
    ["eAISNavigationBase", "eAISNavigation"],
    ["eAISNavigation"],
)


class HU(HttpEurocontrolBase):
    """Hungary AIP crawler (HungaroControl eAIP, task spec:
    europe-expansion.md).

    The English AIS portal lists dated AIRAC edition folders; the edition
    is picked by date (latest on/before today, like UK). The frameset
    entry inside the folder is resolved from candidates - a live-run miss
    prints the folder's real links via the saved error response.
    Aerodromes are "vfr" (NO/PL/SE convention), heliports fail-soft.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _resolve_edition_folder(
        self, html: str, today: datetime.date | None = None
    ) -> str:
        today = today or datetime.date.today()
        soup = self.soup(html)
        candidates: list[tuple[datetime.date, str]] = []
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            m = _EDITION_DATE_RE.search(href.rstrip("/"))
            if not m:
                continue
            year, month, day = (int(g) for g in m.groups())
            try:
                effective = datetime.date(year, month, day)
            except ValueError:
                continue
            folder = urljoin(ROOT_URL, href if href.endswith("/") else href + "/")
            candidates.append((effective, folder))
        if not candidates:
            raise ValueError(f"No dated edition folders found in {ROOT_URL}")
        in_effect = [c for c in candidates if c[0] <= today]
        effective, folder = (
            max(in_effect, key=lambda c: c[0])
            if in_effect
            else min(candidates, key=lambda c: c[0])
        )
        self.logger.info(f"HU edition (effective {effective}): {folder}")
        return folder

    def _enter_nav(self, folder: str) -> tuple[str, str]:
        last_error: Exception | None = None
        for candidate in _INDEX_CANDIDATES:
            entry = urljoin(folder, candidate)
            for chain in _FRAME_CHAINS:
                try:
                    return self.follow_frame_chain(entry, chain)
                except Exception as e:  # 404 or missing frame - next try
                    last_error = e
        assert last_error is not None
        raise last_error

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            root_html = self.fetch(ROOT_URL)
            last_html = root_html
            folder = self._resolve_edition_folder(root_html)

            nav_url, nav_html = self._enter_nav(folder)
            last_url, last_html = nav_url, nav_html

            airports.extend(
                self._extract_section(nav_html, nav_url, _AD2_SECTION_IDS, "vfr")
            )
            try:
                airports.extend(
                    self._extract_section(
                        nav_html, nav_url, _AD3_SECTION_IDS, "heliport"
                    )
                )
            except ValueError:
                self.logger.info("HU: no AD 3 heliport section - skipping")

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"HU crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports

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
