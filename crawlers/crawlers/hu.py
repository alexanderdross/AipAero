"""Hungary (HungaroControl) eAIP crawler.

Source: HungaroControl's English AIS portal at `ais-en.hungarocontrol.hu`
lists dated AIRAC edition folders. This crawler picks the folder in effect
today (like UK), resolves a working frameset entry inside it from a candidate
list, and - like the BE/CZ layout - discovers airports from per-chapter ids
("AD-2.<ICAO>details" / "AD-3.<ICAO>details") because the menu has no aggregate
"AD 2" section. Aerodromes -> "vfr", heliports -> "heliport" (fail-soft).
"""

import datetime
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase
from crawlers.models import ChartLink

COUNTRY = "HU"
# HungaroControl lists dated AIRAC edition folders (probe_eaip run
# 29255990091): `/aip/2026-06-11/` (+ eaip.zip downloads). Pick the latest
# edition already in effect, then enter the eurocontrol frameset inside.
ROOT_URL = "https://ais-en.hungarocontrol.hu/aip/"

# The eAIP carries only the ~8 controlled aerodromes; the ~65 small VFR fields
# live in a separate, bespoke "VFR Manual" index page - a plain HTML table
# (`#sortable-table`) whose rows carry ICAO code, aerodrome name and a per-field
# chart link. VFR-Manual fields link a PDF on storage.hungarocontrol.hu; the
# controlled aerodromes instead link back to the eAIP ("AIP"), so a row with a
# storage-PDF chart is the discriminator for a VFR-Manual-only field.
VFR_MANUAL_URL = "https://ais-en.hungarocontrol.hu/vfrmanual"
_VFR_PDF_HOST = "storage.hungarocontrol.hu"
_ICAO_RE = re.compile(r"^[A-Z]{4}$")

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

# The HU menu has NO aggregate "AD 2" section: every aerodrome is its
# own top-level chapter with an id like "AD-2.LHBPdetails" (live run
# 29260894039 listed 8 such ids). Same layout as CZ/PT.
_AD2_CHAPTER_RE = re.compile(r"AD-2\.([A-Z]{4})details$")
_AD3_CHAPTER_RE = re.compile(r"AD-3\.([A-Z]{4})details$")

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
    prints the folder's real links via the saved error response. The menu
    lists each aerodrome as its own chapter (like CZ/PT). Aerodromes are
    "vfr" (NO/PL/SE convention), heliport chapters fail-soft.
    """

    # Chart-PDF extraction (recon run 29264498572, crawlers/recon/
    # pdf-recon-batch1.md): explicit chart-type codes in the filenames,
    # e.g. LH_AD_2_LHBC_VAC_en.pdf / ..._ADC_en.pdf. Anchor texts are
    # hrefs, so match on href; VAC (visual approach) preferred.
    FETCH_PDF_URLS = True
    PDF_HREF_PRIORITY = (r"_VAC_en\.pdf$", r"_ADC_en\.pdf$")

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _resolve_edition_folder(
        self, html: str, today: datetime.date | None = None
    ) -> str:
        """Pick the dated AIRAC edition folder in effect today.

        Reads the `YYYY-MM-DD` date out of each edition-folder href (relative or
        absolute) and returns the latest folder already in effect (else the
        earliest listed), normalised to a trailing-slash absolute URL.
        """
        today = today or datetime.date.today()
        soup = self.soup(html)
        # Collect (effective_date, absolute_folder_url) for each dated link.
        candidates: list[tuple[datetime.date, str]] = []
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            # Match the date at the end of the href (trailing slash stripped).
            m = _EDITION_DATE_RE.search(href.rstrip("/"))
            if not m:
                continue
            year, month, day = (int(g) for g in m.groups())
            try:
                effective = datetime.date(year, month, day)
            except ValueError:
                # Impossible calendar date in the href - ignore this link.
                continue
            # Normalise to an absolute folder URL with a trailing slash.
            folder = urljoin(ROOT_URL, href if href.endswith("/") else href + "/")
            candidates.append((effective, folder))
        if not candidates:
            raise ValueError(f"No dated edition folders found in {ROOT_URL}")
        # Latest edition already in effect; else the earliest listed one.
        in_effect = [c for c in candidates if c[0] <= today]
        effective, folder = (
            max(in_effect, key=lambda c: c[0])
            if in_effect
            else min(candidates, key=lambda c: c[0])
        )
        self.logger.info(f"HU edition (effective {effective}): {folder}")
        return folder

    def _enter_nav(self, folder: str) -> tuple[str, str]:
        """Return (nav_url, nav_html) for the edition folder's menu frame.

        The frameset entry filename and depth vary, so try each candidate index
        file against each known frame chain and use the first that resolves.
        """
        last_error: Exception | None = None
        # Cross-product of candidate index files x known frame-chain depths.
        for candidate in _INDEX_CANDIDATES:
            entry = urljoin(folder, candidate)
            for chain in _FRAME_CHAINS:
                try:
                    return self.follow_frame_chain(entry, chain)
                except Exception as e:  # 404 or missing frame - next try
                    last_error = e
        assert last_error is not None
        raise last_error

    def _crawl_vfr_manual(self) -> list[Airport]:
        """Harvest the standalone VFR Manual index (the ~65 small VFR fields
        the eAIP omits). Each table row gives the ICAO code (may be "-" for a
        grass strip without one), the aerodrome name, and a chart link; rows
        whose chart is a storage.hungarocontrol.hu PDF are VFR-Manual fields
        (the controlled aerodromes link "AIP" instead and are skipped - they
        already come from the eAIP crawl). Fully fail-soft."""
        airports: list[Airport] = []
        try:
            html = self.fetch(VFR_MANUAL_URL)
        except Exception as e:
            self.logger.warning(f"HU VFR manual: index fetch failed: {e}")
            return airports

        table = self.soup(html).find("table", id="sortable-table")
        if table is None:
            self.logger.warning("HU VFR manual: no #sortable-table on the index")
            return airports

        for row in table.select("tbody tr"):
            cells = row.find_all("td")
            if len(cells) < 10:
                continue  # header/filter row or malformed
            # The chart cell (last) links the PDF for a VFR-Manual field, or
            # "AIP" for a controlled aerodrome (which we skip - it is in eAIP).
            chart_a = cells[-1].find("a", href=True)
            if chart_a is None:
                continue
            href = chart_a["href"].strip()
            if _VFR_PDF_HOST not in href or ".pdf" not in href.lower():
                continue  # "AIP" link or no chart - not a VFR-Manual field
            pdf_url = urljoin(VFR_MANUAL_URL, href.split("?")[0])  # drop GA param

            icao_text = cells[1].get_text(" ", strip=True)
            icao = icao_text if _ICAO_RE.match(icao_text) else None
            name = " ".join(cells[2].get_text(" ", strip=True).split())
            title = f"{name} {icao}".strip() if icao else name
            if not title:
                continue

            airports.append(
                Airport(
                    country=self.country,
                    icao=icao,
                    title=title,
                    url=pdf_url,
                    pdf_url=pdf_url,
                    charts=[ChartLink(name="VFR Manual", url=pdf_url)],
                    type="vfr",
                )
            )
        self.logger.info(f"HU VFR manual: extracted {len(airports)} VFR fields")
        return airports

    def crawl(self) -> list[Airport]:
        """Resolve the current edition, enter the frameset, and list airports."""
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # Edition listing -> currently effective folder -> menu frame.
            root_html = self.fetch(ROOT_URL)
            last_html = root_html
            folder = self._resolve_edition_folder(root_html)

            nav_url, nav_html = self._enter_nav(folder)
            last_url, last_html = nav_url, nav_html

            # Per-chapter discovery (no aggregate "AD 2" node): AD 2 required,
            # AD 3 heliports optional (fail-soft).
            airports.extend(
                self.extract_airports_per_chapter(
                    nav_html, nav_url, _AD2_CHAPTER_RE, "vfr"
                )
            )
            try:
                airports.extend(
                    self.extract_airports_per_chapter(
                        nav_html, nav_url, _AD3_CHAPTER_RE, "heliport"
                    )
                )
            except ValueError:
                self.logger.info("HU: no AD 3 heliport chapters - skipping")

            # Stage 2: capture direct chart-PDF links for the eAIP fields.
            self.attach_pdf_urls(airports)

            # Merge the standalone VFR Manual fields (the small VFR aerodromes
            # the eAIP omits), deduped by ICAO - one crawler owns country HU.
            # Wrapped so a VFR-manual failure can never drop the eAIP fields.
            try:
                have = {a.icao for a in airports if a.icao}
                vfr_added = 0
                for a in self._crawl_vfr_manual():
                    if a.icao and a.icao in have:
                        continue
                    airports.append(a)
                    if a.icao:
                        have.add(a.icao)
                    vfr_added += 1
                self.logger.info(f"HU: merged {vfr_added} VFR-manual fields")
            except Exception as e:
                self.logger.warning(f"HU VFR merge failed (keeping eAIP): {e}")
        except Exception as e:
            self.logger.error(f"HU crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
