"""France AIP crawler.

Source: SIA (Service de l'Information Aeronautique, aviation-civile.gouv.fr),
a standard eurocontrol-style eAIP frameset. Reaching the effective edition is
multi-hop and SIA re-arranges its front page periodically, so the crawl is a
chain of tolerant lookups rather than one fixed URL:

    /plandesite  → "eAIP FRANCE" link
                 → eAIP issues overview page (an <object data="…"> wrapper)
                 → object document listing the dated `index-fr-FR.html` editions
                 → pick the edition effective on/before today
                 → follow the eurocontrol frame chain to the navigation HTML
                 → parse the AD-2/AD-3 sections into Airport rows

Civil aerodromes map to our `aeroport` type (SIA does not split VFR vs IFR the
way we do); military aerodromes map to `mil`. Each section is parsed
independently so a menu change in one does not empty the whole country.
"""

import datetime
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "FR"
ROOT_URL = "https://www.sia.aviation-civile.gouv.fr/plandesite"

# The SIA "object" document links to the currently effective eAIP edition via
# `…/index-fr-FR.html`. It may list more than one edition (current + upcoming),
# so - like the NL/UK crawlers - prefer the latest edition whose date is on or
# before today. We don't know SIA's exact URL date encoding a priori, so try
# the common ISO-ish and day-first forms; if none parses we fall back to the
# first index link (the previous behaviour), which stays correct for a
# single-edition page.
_INDEX_HREF = "index-fr-FR.html"
_DATE_PATTERNS = [
    re.compile(r"(?P<y>\d{4})[-_/](?P<m>\d{2})[-_/](?P<d>\d{2})"),  # 2026-06-11
    re.compile(r"(?P<d>\d{2})[-_/](?P<m>\d{2})[-_/](?P<y>\d{4})"),  # 11-06-2026
]

# The five source sections mapped onto our taxonomy. Civil aerodromes are
# tagged `aeroport` because SIA doesn't split VFR vs IFR the way we do. Each
# section is parsed independently: a menu-format change that drops one section
# should not empty the whole country.
_SECTIONS: list[tuple[str, str]] = [
    ("AD-2-IFRdetails", "aeroport"),
    ("AD-2-VFRdetails", "aeroport"),
    ("AD-2-MILdetails", "mil"),
    ("AD-3details", "aeroport"),
]


class FR(HttpEurocontrolBase):
    """France AIP crawler.

    SIA's site map (`/plandesite`) has an "AIP" section with an
    `eAIP FRANCE` link pointing to the eAIP issues overview. That page
    embeds an `<object data="…">` whose target document carries the link(s)
    to the effective eAIP (`index-fr-FR.html`). From there the eAIP is the
    standard eurocontrol frameset.

    Sections extracted: IFR aerodromes, VFR aerodromes, military aerodromes
    and heliports.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    @staticmethod
    def _find_eaip_france_link(soup):
        """Locate the "eAIP FRANCE" link wherever SIA puts it.

        It now lives in the site's global "AIP" header-nav dropdown; older
        layouts nested it in a `<div id="…plandesite…"><h2>AIP</h2>`. Match on
        the link text alone so either layout works - and require an *exact*
        "eAIP FRANCE" so we never pick up its dropdown siblings ("eAIP CAR SAM
        NAM", "eAIP PAC N/P", "eAIP RUN"), which are regions we don't crawl.
        """
        for a in soup.find_all("a", href=True):
            if a.get_text(strip=True).casefold() == "eaip france":
                return a
        # Looser fallback (e.g. extra whitespace / nested markup in the label).
        for a in soup.find_all("a", href=True):
            text = " ".join(a.get_text().split())
            if text.casefold() == "eaip france":
                return a
        return None

    @staticmethod
    def _extract_date(text: str) -> datetime.date | None:
        """Parse the first edition date embedded in an href, or None.

        Tries each shape in ``_DATE_PATTERNS`` (ISO-ish then day-first);
        rejects impossible combinations (e.g. month 13) via the ValueError
        from ``datetime.date`` and keeps scanning.
        """
        for pattern in _DATE_PATTERNS:
            m = pattern.search(text)
            if not m:
                continue
            try:
                return datetime.date(
                    int(m.group("y")), int(m.group("m")), int(m.group("d"))
                )
            except ValueError:
                continue
        return None

    def _probe_eaip_index(self, home_url: str) -> str | None:
        """Find the eAIP frameset when home.html no longer lists it.

        Dumps `home.js` (diagnostic) and probes the standard eAIP index
        filenames relative to home.html and to the edition root, returning the
        first URL that resolves to a real eurocontrol frameset.
        """
        # home.js drives the front page; dump it so the entry can be traced if
        # the probes below miss. fetch() refuses `.js`, so use the raw client.
        for src in ("../home.js", "home.js"):
            try:
                r = self.client.get(urljoin(home_url, src))
                if r.status_code == 200 and r.text.strip():
                    self.logger.warning(f"FR {src}[:8000]: {r.text[:8000]!r}")
                    break
            except Exception as e:  # noqa: BLE001
                self.logger.warning(f"FR {src} fetch failed: {e}")

        for name in (
            _INDEX_HREF,  # index-fr-FR.html (same dir as home.html)
            "index-en-GB.html",
            "index.html",
            "../" + _INDEX_HREF,  # edition root
            "../index-en-GB.html",
        ):
            cand = urljoin(home_url, name)
            try:
                html = self.fetch(cand)
            except Exception as e:  # noqa: BLE001
                self.logger.warning(f"FR index candidate {name!r}: {e}")
                continue
            is_frameset = "eAISNavigation" in html or "frameset" in html.lower()
            self.logger.warning(
                f"FR index candidate {name!r}: OK {len(html)}b "
                f"frameset={is_frameset}"
            )
            if is_frameset:
                self.logger.info(f"FR: using eAIP index {cand}")
                return cand
        return None

    def _resolve_current_edition_url(
        self,
        base_url: str,
        html: str,
        today: datetime.date | None = None,
    ) -> str:
        """Pick the effective `index-fr-FR.html` edition from the object doc.

        Prefers the latest edition whose date (parsed from the URL) is on or
        before ``today``; falls back to the first index link when no date is
        parseable (single-edition page). Backslashes are normalised to "/" so
        httpx builds a valid URL.
        """
        today = today or datetime.date.today()
        soup = self.soup(html)

        # Collect every `index-fr-FR.html` link with its parsed date (or None).
        candidates: list[tuple[datetime.date | None, str]] = []
        for a in soup.find_all("a", href=True):
            href = a["href"].replace("\\", "/")  # Windows-style separators appear
            if _INDEX_HREF not in href:
                continue
            candidates.append((self._extract_date(href), urljoin(base_url, href)))

        if not candidates:
            # SIA's front page (`…/eAIP_<DATE>/FRANCE/home.html`) is now a
            # JS-driven page (`home.js` + `<body onLoad="init(state, year,
            # month, day, number)">`). home.js builds the effective eAIP index
            # as `'AIRAC-'+year+'-'+month+'-'+day+'/html/index-fr-FR.html'`
            # (assigned to the `dateVig` link) - i.e. under an AIRAC-dated
            # subfolder of FRANCE/, not a flat sibling of home.html. Parse the
            # init() date args and construct that path.
            m = re.search(
                r"init\(\s*'[^']*'\s*,\s*'(\d{4})'\s*,"
                r"\s*'(\d{1,2})'\s*,\s*'(\d{1,2})'",
                html,
            )
            if m:
                edition_url = urljoin(
                    base_url,
                    f"AIRAC-{m.group(1)}-{m.group(2)}-{m.group(3)}"
                    f"/html/{_INDEX_HREF}",
                )
                self.logger.info(
                    f"FR: eAIP index from home.js AIRAC pattern: {edition_url}"
                )
                return edition_url
            # Fallback: probe known filenames (also dumps home.js for diagnosis).
            if base_url.rstrip("/").endswith("home.html"):
                found = self._probe_eaip_index(base_url)
                if found:
                    return found
            raise ValueError(
                f"Current-edition link ({_INDEX_HREF}) not found in {base_url}"
            )

        # Prefer the newest edition already in effect (date <= today); if none
        # is yet effective (only future editions listed), take the earliest.
        dated = [(d, u) for d, u in candidates if d is not None]
        if dated:
            in_effect = [c for c in dated if c[0] <= today]
            effective_date, edition_url = (
                max(in_effect, key=lambda c: c[0])
                if in_effect
                else min(dated, key=lambda c: c[0])
            )
            self.logger.info(
                f"Current FR edition (effective {effective_date.isoformat()}): "
                f"{edition_url}"
            )
            return edition_url

        self.logger.info(
            f"Current FR edition (undated, first match): {candidates[0][1]}"
        )
        return candidates[0][1]

    # Chart-PDF extraction (recon 2026-07-12): semantic hrefs under
    # Cartes/<ICAO>/, e.g. AD_2_LFBA_ADC_01.pdf (aerodrome chart). The base's
    # attach_pdf_urls() uses these ordered regexes to pick the primary chart:
    # the numbered ADC first, then any ADC, then the combined APDC.
    FETCH_PDF_URLS = True
    PDF_HREF_PRIORITY = (r"_ADC_01\.pdf$", r"_ADC_", r"_APDC_")

    def crawl(self) -> list[Airport]:
        """Resolve the effective SIA eAIP and parse its AD-2/AD-3 sections.

        Walks the /plandesite → object-doc → edition → frame-chain hops above,
        parses each ``_SECTIONS`` menu independently (a missing section is a
        warning, not a failure), then attaches direct chart-PDF links. On any
        failure the last fetched page is saved for post-mortem before re-raising.
        """
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. /plandesite → AIP section → "eAIP FRANCE" link.
            plandesite_html = self.fetch(ROOT_URL)
            last_url, last_html = ROOT_URL, plandesite_html

            soup = self.soup(plandesite_html)
            eaip_pre_link = self._find_eaip_france_link(soup)
            if eaip_pre_link is None:
                raise ValueError(f"'eAIP FRANCE' link not found in {ROOT_URL}")

            eaip_pre_url = urljoin(
                ROOT_URL, eaip_pre_link["href"].replace("\\", "/")
            )

            # 2. eAIP issues overview → <object data="…">.
            eaip_pre_html = self.fetch(eaip_pre_url)
            last_url, last_html = eaip_pre_url, eaip_pre_html

            obj = self.soup(eaip_pre_html).find("object", attrs={"data": True})
            if obj is None:
                raise ValueError(
                    f"<object data=…> not found in {eaip_pre_url}"
                )
            object_url = urljoin(eaip_pre_url, obj["data"].replace("\\", "/"))

            # 3. Object document → currently effective eAIP edition (by date).
            object_html = self.fetch(object_url)
            last_url, last_html = object_url, object_html

            edition_url = self._resolve_current_edition_url(object_url, object_html)

            # 4. Walk the frame chain to the navigation HTML.
            nav_url, nav_html = self.follow_frame_chain(
                edition_url, ["eAISNavigationBase", "eAISNavigation"]
            )
            last_url, last_html = nav_url, nav_html

            # 5. Parse each section independently; tolerate a missing one.
            section_errors: list[str] = []
            for menu_id, category in _SECTIONS:
                try:
                    airports.extend(
                        self.extract_airports_from_html(
                            nav_html, nav_url, menu_id, category  # type: ignore[arg-type]
                        )
                    )
                except ValueError as section_err:
                    self.logger.warning(
                        f"FR section {menu_id!r} skipped: {section_err}"
                    )
                    section_errors.append(f"{menu_id}: {section_err}")

            if not airports:
                raise ValueError(
                    f"No FR sections could be parsed from {nav_url}: "
                    f"{'; '.join(section_errors)}"
                )

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"FR crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
