import datetime
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "FR"
ROOT_URL = "https://www.sia.aviation-civile.gouv.fr/plandesite"

# The SIA "object" document links to the currently effective eAIP edition via
# `…/index-fr-FR.html`. It may list more than one edition (current + upcoming),
# so — like the NL/UK crawlers — prefer the latest edition whose date is on or
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
        the link text alone so either layout works — and require an *exact*
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

        candidates: list[tuple[datetime.date | None, str]] = []
        for a in soup.find_all("a", href=True):
            href = a["href"].replace("\\", "/")
            if _INDEX_HREF not in href:
                continue
            candidates.append((self._extract_date(href), urljoin(base_url, href)))

        if not candidates:
            # Diagnostic: SIA changed the object-document structure. Dump the
            # navigable references so we can see the new edition-entry pattern.
            self.logger.warning(
                f"FR: no {_INDEX_HREF} link in {base_url}; dumping references:"
            )
            for tag in soup.find_all(["a", "frame", "iframe", "object"])[:50]:
                ref = tag.get("href") or tag.get("src") or tag.get("data")
                if ref:
                    label = " ".join(tag.get_text().split())[:60]
                    self.logger.warning(
                        f"  <{tag.name}> {ref} | {label!r}"
                    )
            raise ValueError(
                f"Current-edition link ({_INDEX_HREF}) not found in {base_url}"
            )

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

    def crawl(self) -> list[Airport]:
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
        except Exception as e:
            self.logger.error(f"FR crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
