import datetime
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "IS"
# Isavia lists dated edition folders on the host root (probe_eaip run
# 29255990091): `A_06-2026_2026_06_11/`, `A_07-2026_2026_08_06/` (future).
# Pick the latest edition already in effect, then enter the eurocontrol
# frameset inside the folder.
ROOT_URL = "https://eaip.isavia.is/"

_EDITION_DATE_RE = re.compile(r"_(\d{4})_(\d{2})_(\d{2})/?$")
_INDEX_CANDIDATES = ["index-en-GB.html", "index.html", "html/index-en-GB.html", "html/index.html"]

_AD2_SECTION_IDS = ["AD 2en-GBdetails", "AD-2details", "AD 2details"]

# Isavia lists each field as its own top-level chapter, in BOTH
# languages and split into numbered sub-pages (live run 29260894039):
#   "AD BIAR AKUREYRI - AKUREYRIen-GBdetails"      <- chapter (wanted)
#   "AD BIAR AKUREYRI - AKUREYRI 1en-GBdetails"    <- sub-page (skip)
#   "AD BIAR AKUREYRI - AKUREYRIis-ISdetails"      <- Icelandic twin (skip)
# Landing sites use an "LS" prefix ("BI-LS BITM ..." page URLs). Match
# only the English top-level chapters: no digit right before "en-GB".
# The aggregate "AD 2en-GBdetails" section stays as fallback (it held
# just BITN + BITM on the live menu).
_CHAPTER_RE = re.compile(r"^(?:AD|LS) ([A-Z]{4}) .*(?<!\d)en-GBdetails$")
# Titles look like "AD BIAR AKUREYRI - AKUREYRI" - strip the "AD BIAR "
# prefix (the base default expects the "AD 2.XXXX" style instead).
_TITLE_PREFIX_RE = re.compile(r"^(?:AD|LS)\s+[A-Z]{4}\s*", re.I)

_FRAME_CHAINS = (
    ["eAISNavigationBase", "eAISNavigation"],
    ["eAISNavigation"],
)


class IS(HttpEurocontrolBase):
    """Iceland AIP crawler (Isavia eAIP, task spec: europe-expansion.md).

    Root lists dated AIRAC edition folders; the edition is picked by its
    embedded effective date (latest on/before today, like NL/UK). Frameset
    entry and frame-chain layout are resolved from candidate lists - the
    base's diagnostics print the real ids on a miss. Every aerodrome (AD)
    and landing site (LS) is its own top-level menu chapter; all are
    emitted as "vfr" (NO/PL/SE convention).
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
        self.logger.info(f"IS edition (effective {effective}): {folder}")
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

            try:
                airports.extend(
                    self.extract_airports_per_chapter(
                        nav_html,
                        nav_url,
                        _CHAPTER_RE,
                        "vfr",
                        title_prefix_re=_TITLE_PREFIX_RE,
                    )
                )
            except ValueError as e:
                self.logger.warning(
                    f"IS: per-chapter parse failed ({e}); "
                    "falling back to the aggregate section"
                )
                airports.extend(
                    self._extract_section(
                        nav_html, nav_url, _AD2_SECTION_IDS, "vfr"
                    )
                )

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"IS crawl failed: {e}")
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
