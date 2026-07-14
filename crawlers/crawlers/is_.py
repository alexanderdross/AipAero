import datetime
import re
import unicodedata
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase


# Icelandic/Nordic letters NFKD does NOT decompose - map them the way the
# AIP's ASCII transliteration does (Ð->D, Þ->TH, Æ->AE, Ø/Å->O/A).
_TRANSLIT = str.maketrans(
    {
        "Ð": "D", "ð": "d", "Þ": "TH", "þ": "th",
        "Æ": "AE", "æ": "ae", "Ø": "O", "ø": "o", "Å": "A", "å": "a",
    }
)


def _fold(text: str) -> str:
    """Accent-fold + uppercase for comparison so the native and transliterated
    halves match (BÚÐARDALUR -> BUDARDALUR, GRUNDARFJÖRÐUR -> GRUNDARFJORDUR)."""
    stripped = "".join(
        c
        for c in unicodedata.normalize("NFKD", text.translate(_TRANSLIT))
        if not unicodedata.combining(c)
    )
    return stripped.upper().strip()


def _dedupe_native_ascii(name: str) -> str:
    """Isavia's chapter id repeats the field name as "<native> - <ASCII>"
    (e.g. "BÍLDUDALUR - BILDUDALUR", "AKUREYRI - AKUREYRI"); keep only the
    native half when the ASCII half is just a transliteration of it, so the
    title is not doubled. The ASCII half can also DROP a word the native one
    keeps ("HÖFN Í HORNAFIRÐI - HOFN HORNAFIRDI" drops the standalone "Í"), so
    an exact fold match is too strict - collapse whenever the ASCII half's
    folded word set is a subset of the native half's (never has extra words).
    A genuinely two-part name (ASCII half carries a distinct word) is left
    untouched."""
    if " - " not in name:
        return name
    left, right = name.split(" - ", 1)
    left_words = _fold(left).split()
    right_words = _fold(right).split()
    if right_words and set(right_words) <= set(left_words):
        return left.strip()
    return name

COUNTRY = "IS"
# Isavia lists dated edition folders on the host root (probe_eaip run
# 29255990091): `A_06-2026_2026_06_11/`, `A_07-2026_2026_08_06/` (future).
# Pick the latest edition already in effect, then enter the eurocontrol
# frameset inside the folder.
ROOT_URL = "https://eaip.isavia.is/"

# Trailing `_YYYY_MM_DD/` on an edition folder href = its effective date.
_EDITION_DATE_RE = re.compile(r"_(\d{4})_(\d{2})_(\d{2})/?$")
# Frameset entry filenames to try inside the chosen edition folder, in order.
_INDEX_CANDIDATES = ["index-en-GB.html", "index.html", "html/index-en-GB.html", "html/index.html"]

# Aggregate AD 2 menu-section id variants (fallback path; the primary path
# reads each field's own chapter - see _CHAPTER_RE below).
_AD2_SECTION_IDS = ["AD 2en-GBdetails", "AD-2details", "AD 2details"]

# Isavia lists each field as its own top-level chapter, in BOTH
# languages and split into numbered sub-pages (live run 29260894039):
#   "AD BIAR AKUREYRI - AKUREYRIen-GBdetails"      <- chapter (wanted)
#   "AD BIAR AKUREYRI - AKUREYRI 1en-GBdetails"    <- sub-page (skip)
#   "AD BIAR AKUREYRI - AKUREYRIis-ISdetails"      <- Icelandic twin (skip)
# Landing sites use an "LS" prefix ("BI-LS BITM ..." page URLs). Match
# only the English top-level chapters: no digit right before "en-GB".
# The aggregate "AD 2en-GBdetails" section stays as fallback (it held
# just BITN + BITM on the live menu). Some fields match TWICE (run
# 29264498572 emitted "BIAR | BIAR" and "BIAR | AKUREYRI - AKUREYRI 8
# BIAR"), so extraction dedupes by ICAO and takes the title from the
# id itself (group 2) instead of the sibling title div.
# Match an English top-level chapter id: "AD"/"LS", then the 4-letter ICAO
# (group 1), then the title (group 2). The `(?<!\d)` before "en-GB" rejects
# numbered SUB-pages ("... AKUREYRI 1en-GBdetails"); the "en-GB" anchor
# rejects the Icelandic ("is-IS") twins.
_CHAPTER_RE = re.compile(r"^(?:AD|LS) ([A-Z]{4}) (.*?)(?<!\d)en-GBdetails$")

# Frameset layouts to try when entering the nav frame (base+nav, or nav only).
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

    # Stage 2: Isavia links every AD 2.24 chart PDF on the aerodrome's own
    # "8" (charts) page as plain anchors under
    # `documents/Root_WePub/Rep_ISAVIA/Charts/AD/<ICAO>/PART_8/<ICAO>_8_<DESIG>_*.pdf`
    # (pdf_recon run 29355638020). Prefer the visual/aerodrome charts a VFR
    # pilot needs; fall back to the first captured PDF otherwise.
    FETCH_PDF_URLS = True
    # Isavia's visual chart is named `<ICAO>_8_VFR_...` (BIKF/BIRK, crawl run
    # 29356002129); prefer it, then the aerodrome / visual-approach charts,
    # else the first captured PDF. Only ~7 of 53 fields publish a chart PDF at
    # all (the major aerodromes); the small gravel landing sites carry only a
    # textual AD entry, so pdf_url stays None there and the row falls back to
    # the chart page url.
    PDF_HREF_PRIORITY = (
        r"_VFR[_.]",
        r"_ADC[_.]",
        r"AERODROME_CHART",
        r"_VAC[_.]",
        r"VISUAL_APP",
        r"_LDG[_.]",
    )

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _resolve_edition_folder(
        self, html: str, today: datetime.date | None = None
    ) -> str:
        """Pick the effective AIRAC edition folder from the host root listing.

        Parses each `A_..._YYYY_MM_DD/` folder href into its effective date and
        returns the latest one on/before ``today`` (falling back to the
        earliest if all are still future, e.g. right before a cycle switch).
        """
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
            # Normalise to a trailing-slash absolute folder URL.
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

    def _extract_chapters(self, nav_html: str, nav_url: str) -> list[Airport]:
        """One airport per AD/LS chapter, deduped by ICAO.

        The title comes from the chapter id itself ("AD BIAR AKUREYRI -
        AKUREYRI..." -> "AKUREYRI - AKUREYRI BIAR") - the sibling title
        div is unreliable here (empty for parents, sub-page labels for
        the nested duplicates). The first div per ICAO that carries a
        charts link wins (document order: the parent chapter).
        """
        soup = self.soup(nav_html)
        # Keyed by ICAO so the first (parent-chapter) div wins and the
        # duplicate/sub-page divs for the same field are dropped.
        by_icao: dict[str, Airport] = {}
        for details in soup.find_all("div", attrs={"id": _CHAPTER_RE}):
            match = _CHAPTER_RE.search(details["id"])
            if not match:  # pragma: no cover - find_all already matched
                continue
            icao = match.group(1)
            if icao in by_icao:
                continue
            # The parent chapter is the one that carries a charts link.
            charts_url = self._find_charts_url(details, nav_url)
            if charts_url is None:
                # A nested duplicate may still carry the link - only
                # warn once no div for this ICAO produced one.
                continue
            # Collapse whitespace in the id-derived title (group 2), then drop
            # the redundant transliterated half ("BÍLDUDALUR - BILDUDALUR").
            name = _dedupe_native_ascii(" ".join(match.group(2).split()))
            by_icao[icao] = Airport(
                country=self.country,
                icao=icao,
                title=f"{name} {icao}".strip() if name else icao,
                url=charts_url,
                type="vfr",
            )
        if not by_icao:
            # Nothing matched: dump the available "*details" ids so a markup
            # change is visible in the crawl log before raising.
            candidates = sorted(
                {
                    el["id"]
                    for el in soup.find_all(attrs={"id": True})
                    if "details" in el["id"].lower()
                }
            )[:60]
            raise ValueError(
                f"No AD/LS chapters matching {_CHAPTER_RE.pattern!r} in "
                f"{nav_url}. Available *details ids: {candidates}"
            )
        return list(by_icao.values())

    def _enter_nav(self, folder: str) -> tuple[str, str]:
        """Enter the nav frame, trying each index filename x frame-chain combo.

        The exact frameset entry file and inner-frame layout vary across
        editions, so brute-force every (_INDEX_CANDIDATES, _FRAME_CHAINS)
        pairing and return the first that resolves; the last error is re-raised
        if none do.
        """
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
        """Root -> effective edition folder -> nav frame -> per-chapter parse.

        The per-chapter parse is primary; if it finds nothing it falls back to
        the aggregate AD 2 section. All fields are "vfr" (NO/PL/SE convention).
        The last page fetched is dumped on failure before re-raising.
        """
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

            # Primary: one airport per AD/LS chapter. Fall back to the
            # aggregate section if the per-chapter layout does not match.
            try:
                airports.extend(self._extract_chapters(nav_html, nav_url))
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
