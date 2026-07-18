"""Italy (ENAV) eAIP crawler.

The earlier "gated" verdict was wrong: alongside the login-only Self Briefing
portal, ENAV publishes an **open** static eurocontrol (WePub) eAIP at

    https://onlineservices.enav.it/enavWebPortalStatic/AIP/AIP/

Each AIRAC edition is a dated folder directly under `.../AIP/AIP/`:

    (A<NN>-<YY>)_<YYYY>_<MM>_<DD>/index.html      e.g. (A07-26)_2026_07_09/

`default.html` is the issues index; this crawler reads the effective date out of
every edition folder it names, picks the one in effect today, and fetches that
edition's navigation menu directly (`.../eAIP/LI-menu-en-GB.html` - the classic
3-frame eurocontrol layout, so the menu URL is deterministic). AD 2 aerodromes
are read with an aggregate-section then per-chapter fallback (the AL/SI
pattern), all `vfr`; chart PDFs are `LI_AD_2_<ICAO>_<section>_en_<date>.pdf`.
Pure HTML, no JS/browser, no login. LI is the Italy ICAO prefix.
"""

import datetime
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "IT"
ROOT_URL = (
    "https://onlineservices.enav.it/enavWebPortalStatic/AIP/AIP/default.html"
)

# The edition folder name "(A07-26)_2026_07_09" (parens raw or %28/%29-encoded
# depending on how default.html serialises the href/JS string). Captures the
# effective date so the currently effective edition can be picked; scanned
# against the landing's RAW HTML so it is found whether default.html links it as
# an <a>, a frame src, or an inline JS string.
_EDITION_RE = re.compile(
    r"(?:\(|%28)A\d{2}-\d{2}(?:\)|%29)_(\d{4})_(\d{2})_(\d{2})", re.I
)

# Menu (nav) frame under the edition's html/eAIP/ folder.
_MENU_SUFFIX = "eAIP/LI-menu-en-GB.html"

# Aggregate AD 2 menu-section id variants (tried in order), then the per-airport
# chapter fallback. ENAV's chapter ids/hrefs use a SPACE after "AD 2" (not the
# dotted "AD 2.LIBC" form), so the chapter regex allows a space or a dot.
_AD2_SECTION_IDS = ["AD 2en-GBdetails", "AD-2details", "AD 2details"]
_AD2_CHAPTER_RE = re.compile(r"AD[ -]2[. ]([A-Z]{4}).*details$")


class IT(HttpEurocontrolBase):
    """Italy (ENAV) AIP crawler - open static eurocontrol eAIP.

    The current edition is picked by date from `default.html`, then the menu
    frame is fetched directly (deterministic path) and AD 2 read.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _resolve_menu_url(
        self, html: str, today: datetime.date | None = None
    ) -> str:
        """Return the currently effective edition's navigation-menu URL.

        Scans the landing HTML for every edition folder, reads its effective
        date, and picks the latest on/before ``today`` (earliest if all are
        unexpectedly in the future), then points at that edition's
        `eAIP/LI-menu-en-GB.html`.
        """
        today = today or datetime.date.today()
        candidates: list[tuple[datetime.date, str]] = []
        seen: set[str] = set()
        for m in _EDITION_RE.finditer(html):
            try:
                eff = datetime.date(
                    int(m.group(1)), int(m.group(2)), int(m.group(3))
                )
            except ValueError:
                continue
            folder = m.group(0)  # e.g. "(A07-26)_2026_07_09" (parens/encoded)
            if folder in seen:
                continue
            seen.add(folder)
            # Editions sit directly under `.../AIP/AIP/`, the dir of default.html.
            root = urljoin(ROOT_URL, folder + "/")
            candidates.append((eff, root))

        if not candidates:
            raise ValueError(
                f"IT: no eAIP edition folder found in {ROOT_URL}. "
                f"HTML head: {' '.join(html.split())[:400]}"
            )

        in_effect = [c for c in candidates if c[0] <= today]
        eff, root = (
            max(in_effect, key=lambda c: c[0])
            if in_effect
            else min(candidates, key=lambda c: c[0])
        )
        menu_url = urljoin(root, _MENU_SUFFIX)
        # Forward the effective edition to crawl_meta.airac so every detail page
        # shows the AIRAC (the chart URL also carries its own date, see
        # charts.ts AIRAC_PATTERNS).
        self.airac = eff.isoformat()
        self.logger.info(
            f"IT current edition (effective {eff.isoformat()}): {menu_url}"
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

    # Chart-PDF extraction: ENAV AD 2.24 charts are LI_AD_2_<ICAO>_<section>_en_
    # <date>.pdf. Priorities are provisional (refined from the live pdf_recon);
    # prefer an aerodrome/visual chart, else the first PDF found on the page.
    FETCH_PDF_URLS = True
    PDF_HREF_PRIORITY = (r"_ADC", r"_VAC", r"_2-1_", r"_5-1_")

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
                    f"IT: aggregate AD 2 parse failed ({e}); "
                    "trying per-airport chapters"
                )
                airports.extend(
                    self.extract_airports_per_chapter(
                        nav_html, menu_url, _AD2_CHAPTER_RE, "vfr"
                    )
                )

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
            self.logger.error(f"IT crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
