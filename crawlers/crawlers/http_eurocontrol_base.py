import re
from typing import Literal
from urllib.parse import urljoin

from bs4 import Tag

from crawlers.http_base import Airport, HttpCrawlerBase
from crawlers.operating_hours import parse_ad23_text

__all__ = ["HttpEurocontrolBase", "ad23_hours"]

# The site's five airport categories; passed in by each crawler per section.
AirportType = Literal["vfr", "ifr", "heliport", "mil", "aeroport"]

# Per-chapter title anchors look like "AD 2.LKPR PRAHA/Ruzyně" - the
# chapter prefix is stripped before the ICAO dedupe.
# Strips the chapter prefix "AD 2.LKPR"/"AD 4.LJAJ" from a title anchor. Covers
# AD 2/3/4 so the small-VFR AD 4 chapters (Slovenia) are cleaned too.
_CHAPTER_TITLE_PREFIX_RE = re.compile(r"^AD\s*[234]\.[A-Z]{4}\s*", re.I)

# Title-quality guard: a "name" that is really a chart designator (NL menu
# labels its entries "<ICAO> VAC") or AD-section boilerplate (ES "Aerodrome
# data.", FI "AD 3.23 ... KARTAT") is NOT a place name. `title_name_looks_bad`
# flags these so the crawl log warns (with the raw markup) and a launch check
# can catch a new country before it ships a listing of chart codes.
_CHART_DESIGNATOR_RE = re.compile(
    r"^(VAC|IAC|ADC|AOC|APDC|GMC|PATC|SID|STAR|SMAC|PDC|LDG|TAXI|PARK|GROUND"
    r"|OACI|VFR|IFR|AD|HEL)$",
    re.I,
)
_TITLE_BOILERPLATE_RE = re.compile(
    r"charts?\s+related|aerodrome\s+data|aeronautical\s+data"
    r"|koskevat\s+kartat|see\s+alerts|\bAD\s*[23]\.\d",
    re.I,
)


def title_name_looks_bad(name: str) -> bool:
    """True if ``name`` (the part before the ICAO) is empty, a bare chart
    designator, or AD-section boilerplate rather than a real place name."""
    n = name.strip()
    return (
        not n
        or bool(_CHART_DESIGNATOR_RE.match(n))
        or bool(_TITLE_BOILERPLATE_RE.search(n))
    )


# The AD 2.1 "AERODROME LOCATION INDICATOR AND NAME" line of an AD 2 page reads
# "<ICAO> - <NAME>", terminated by the AD 2.2 heading. It is the reliable name
# source for eAIPs whose nav MENU carries no aerodrome name at all (NL, ES) -
# their menu lists only the ICAO + section labels, so the name must be read
# from the per-aerodrome page. The label itself varies ("... AND NAME" vs
# "... AND - NAME" on ENAIRE); the separator before the name may be "-", an
# en/em dash, a slash or just whitespace (so it is optional); and the AD 2.2
# heading may repeat the ICAO ("<ICAO> AD 2.2 ..." on LVNL), which the
# non-greedy capture would otherwise swallow (stripped below).
_AD21_NAME_RE = re.compile(
    r"(?:AERODROME|HELIPORT) LOCATION INDICATOR\s*(?:AND\s*)?-?\s*NAME\s+"
    r"([A-Z]{4})\s*[-–—/]?\s*(.+?)\s+"
    r"(?:(?:AERODROME|HELIPORT) GEOGRAPHICAL|AD\s*[23]\.2)\b",
    re.I | re.S,
)
# Marker used to slice a diagnostic snippet when the pattern misses. The label
# varies on ENAIRE: "INDICATOR AND NAME" (LECO) vs "INDICATOR - NAME" (LEBB),
# so "AND" and the dash are both optional.
_AD21_MARKER_RE = re.compile(r"LOCATION INDICATOR\s*(?:AND\s*)?-?\s*NAME", re.I)


def _collapse_exact_dup(name: str) -> str:
    """Collapse a name that repeats itself around a "/" or " - " separator
    (LVNL renders "AMELAND/AMELAND"; an exact repeat is redundant). Only an
    EXACT duplicate is collapsed - "AMSTERDAM/SCHIPHOL" and "MAASTRICHT/
    MAASTRICHT AACHEN" (distinct halves) are left untouched."""
    for sep in ("/", " - "):
        if sep in name:
            left, _, right = name.partition(sep)
            if left.strip() and left.strip().casefold() == right.strip().casefold():
                return left.strip()
    return name


def ad21_name(page_text: str, icao: str) -> str | None:
    """The aerodrome name from an AD 2 page's "AD 2.1 AERODROME LOCATION
    INDICATOR AND NAME" line ("<ICAO> - <NAME>").

    For eAIPs whose nav menu carries no name (NL lists only "AD 2 <ICAO>";
    ENAIRE lists "Aerodrome data."), the crawler fetches the per-aerodrome AD 2
    page and reads the name from here. ``page_text`` is the page's collapsed
    visible text. Returns None when the line is absent or its ICAO does not
    match (fail-soft: the caller keeps its existing title). Module-level so
    both HttpCrawlerBase (ES) and eurocontrol crawlers (NL) can use it."""
    match = _AD21_NAME_RE.search(page_text)
    if not match or match.group(1).upper() != icao.upper():
        return None
    name = " ".join(match.group(2).split())
    # LVNL's next heading reads "<ICAO> AD 2.2 ...", so the non-greedy capture
    # can end with the repeated ICAO - strip it so the title is not doubled.
    name = re.sub(rf"\s+{re.escape(icao)}$", "", name, flags=re.I).strip()
    name = _collapse_exact_dup(name)
    return name or None


# The AD 2.3 "OPERATIONAL HOURS" section of an AD 2 page is the standard ICAO
# multi-row table: "1 AD operator|administration <hours> 2 Customs and
# immigration <hours> 3 Health ... 4 AIS ... 5 ATS reporting office (ARO) ...
# 6 MET ... 7 ATS ... 8 Fuelling ... 12 Remarks ...". The AERODROME'S OWN hours
# are ROW 1 (AD operator / administration); the later service rows carry their
# OWN hours (AIS/ARO are frequently centrally H24) and MUST NOT be read as the
# field's hours. So we slice from the AD 2.3 heading to the next AD 2.x heading,
# then isolate row 1 by cutting at the first service-row label (row 2 is always
# "Customs and immigration"). Validated live against NL (EHBD 0600-2200 vs the
# AIS/ARO H24 that a naive slice wrongly picked up; EHAM H24). The anchor
# id/title "<ICAO> AD 2.3 OPERATIONAL HOURS" is stable across eurocontrol eAIPs.
_AD23_SECTION_RE = re.compile(
    r"AD\s*2\.3\s*OPERATIONAL HOURS\b(.*?)(?:\bAD\s*2\.(?:4|\d\d)\b)",
    re.I | re.S,
)
# Row-2+ service labels; the earliest occurrence marks the end of row 1 (the
# aerodrome operator/administration row). Ordered by how universal each is.
_AD23_SERVICE_LABELS = (
    "customs",
    "health and san",
    "ais briefing",
    "ats reporting office",
    "met briefing",
)
# Multi-page eAIPs (NL-style) split each aerodrome's AD 2 chapters across pages:
# the "Charts related to an aerodrome" link (a field's `url`) points at the
# charts section (e.g. "EH-AD 2 EHAM 14-en-GB.html"), but AD 2.3 lives on
# section 1 ("...EHAM 1-en-GB.html"). This rewrites the trailing section number
# to 1 as a fallback. Single-page eAIPs (SK-style, "LZ-AD-2.LZIB-en-SK.html")
# have no "<ICAO> <N>-en" shape, so the pattern does not match and the primary
# `url` fetch (which already carries AD 2.3) is used as-is.
_AD2_SECTION1_RE = re.compile(r"(AD\s*2[\s.]+[A-Z]{4}\s+)\d+(-en)", re.I)


def ad23_hours(page_text: str):
    """Structured operation hours from an AD 2 page's "AD 2.3 OPERATIONAL HOURS"
    section (see crawlers.operating_hours). ``page_text`` is the page's collapsed
    visible text. Returns a 7-day StructuredHours list, or None when the section
    is absent / unparseable (fail-soft; the AUTHORITATIVE source, posted to
    /api/airport-facts with hoursSource="eaip"). Reads ONLY row 1 (the aerodrome
    operator/administration hours); if row 1 cannot be isolated (no service-row
    label found) it returns None rather than risk reading a service row's hours -
    a wrong "open" is worse than none. Module-level so any eurocontrol crawler
    can call it on the AD 2 page it already fetches for the AD 2.1 name."""
    m = _AD23_SECTION_RE.search(page_text)
    if not m:
        return None
    section = m.group(1)
    low = section.lower()
    # End of row 1 = start of the first service row (row 2 "Customs...").
    cut = min(
        (i for i in (low.find(lbl) for lbl in _AD23_SERVICE_LABELS) if i >= 0),
        default=-1,
    )
    if cut <= 0:
        return None  # cannot isolate the aerodrome row -> do not assert hours
    return parse_ad23_text(section[:cut])


def ad21_debug_snippet(page_text: str) -> str:
    """A short window of the page text around the AD 2.1 name marker, for the
    crawl log when ``ad21_name`` misses - shows the real markup so the pattern
    can be adjusted without another blind runner round."""
    m = _AD21_MARKER_RE.search(page_text)
    if not m:
        return "(no 'LOCATION INDICATOR AND NAME' marker on page)"
    return page_text[m.start() : m.start() + 220]


class HttpEurocontrolBase(HttpCrawlerBase):
    """Shared parser for the eurocontrol "eAIP" navigation HTML.

    The navigation page is a single static document that lists every
    aerodrome / heliport under a tree of `<div>`s. Each entry is two
    sibling `<div>`s: the first holds the title (with the ICAO code), the
    second holds the per-airport links - including the "Charts related to
    an aerodrome" link we want.

    Two entry points cover the two menu shapes seen in the wild:
    ``extract_airports_from_html`` for one aggregate "AD 2/AD 3" section that
    lists all fields, and ``extract_airports_per_chapter`` for eAIPs where each
    aerodrome is its own top-level chapter with no aggregate section.
    """

    def collect_ad23_hours(self, airports: list[Airport]) -> None:
        """Collect the AUTHORITATIVE eAIP AD 2.3 operation hours for every
        aerodrome into ``self.hours_by_icao`` (published by main.py with
        hoursSource="eaip"). Generic across the eurocontrol eAIPs:

        - single-page layouts (SK-style: all AD 2.x on one page) carry AD 2.3 on
          the aerodrome's own ``url`` (fragment stripped);
        - multi-page layouts (NL-style: sections split across pages) keep charts
          on section N and AD 2.3 on section 1, so a section-1 URL rewrite is
          tried as a fallback (`_AD2_SECTION1_RE`).

        One extra HTTP fetch per field, via a dedicated short-lived client (the
        crawler's own client may be closed after crawl()). Fully fail-soft: any
        per-field error is swallowed and the field is simply left without hours.
        Fields already collected (e.g. NL primes them for free in its AD 2.1 name
        loop) are skipped, so this never double-fetches them. Row isolation +
        the conservative `unknown` bucket (see ad23_hours) keep a misparse safe;
        the live-test prints per-country coverage so quirks surface before the
        publish relies on them."""
        import httpx

        client = httpx.Client(
            follow_redirects=True,
            timeout=httpx.Timeout(30.0, connect=10.0),
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
                )
            },
        )
        found = 0
        try:
            for a in airports:
                icao = (a.icao or "").strip().upper()
                if not icao or icao in self.hours_by_icao:
                    continue
                base_url = (a.url or "").split("#", 1)[0]
                if not base_url:
                    continue
                hours = self._ad23_from_url(client, base_url)
                if hours is None:
                    alt = _AD2_SECTION1_RE.sub(r"\g<1>1\g<2>", base_url)
                    if alt != base_url:
                        hours = self._ad23_from_url(client, alt)
                if hours:
                    self.hours_by_icao[icao] = hours
                    found += 1
        finally:
            client.close()
        self.logger.info(
            f"{self.country}: collected AD 2.3 hours for "
            f"{len(self.hours_by_icao)} fields (+{found} this pass)"
        )

    def _ad23_from_url(self, client, url: str):
        """Fetch one AD 2 page and return its AD 2.3 hours, or None (fail-soft)."""
        try:
            r = client.get(url)
            r.raise_for_status()
            text = " ".join(self.soup(r.text).get_text(" ").split())
            return ad23_hours(text)
        except Exception as e:  # a bad page must not abort the whole country
            self.logger.debug(f"AD 2.3 fetch failed for {url}: {e}")
            return None

    def extract_airports_from_html(
        self,
        html: str,
        base_url: str,
        id_in_menu: str,
        category: AirportType,
    ) -> list[Airport]:
        """Parse one menu section (e.g. "AD-2-IFRdetails") into airports."""
        self.logger.info(
            f"Extracting airports from {base_url} (section id$={id_in_menu!r})"
        )
        soup = self.soup(html)

        # Match any element whose id ends with `id_in_menu`. We do this
        # with a substring check rather than a CSS attribute selector
        # because some country eAIPs put spaces and locale codes in the id.
        menu_div: Tag | None = None
        for el in soup.find_all(attrs={"id": True}):
            if el["id"].endswith(id_in_menu):
                menu_div = el
                break
        if menu_div is None:
            # Diagnostic: list the ids that DO exist so a failed live run
            # tells us the real section id without needing the saved HTML.
            candidates = sorted(
                {
                    el["id"]
                    for el in soup.find_all(attrs={"id": True})
                    if "details" in el["id"].lower()
                }
            )[:40]
            raise ValueError(
                f"Menu div ending with {id_in_menu!r} not found in {base_url}. "
                f"Available *details ids: {candidates}"
            )

        # Direct child <div>s only - same as the original `> div` selector.
        menu_items = [c for c in menu_div.find_all("div", recursive=False)]
        # Entries come as (title div, details div) pairs: zip the even-indexed
        # divs with the odd-indexed ones. A trailing unpaired div is dropped.
        paired = list(zip(menu_items[::2], menu_items[1::2]))
        self.logger.debug(
            f"Section {id_in_menu!r}: {len(menu_items)} items, "
            f"{len(paired)} pairs"
        )

        airports: list[Airport] = []
        for title_div, details_div in paired:
            # _parse_pair returns None for non-airport pairs (no anchors, no
            # charts link); those are silently skipped.
            airport = self._parse_pair(title_div, details_div, base_url, category)
            if airport is not None:
                airports.append(airport)

        # Zero airports means the section id matched but the layout changed -
        # treat as a hard failure so the drop guard / live test catches it.
        if not airports:
            raise ValueError(
                f"No airports found for section {id_in_menu!r} in {base_url}"
            )
        return airports

    def extract_airports_per_chapter(
        self,
        html: str,
        base_url: str,
        section_re: re.Pattern[str],
        category: AirportType,
        title_prefix_re: re.Pattern[str] | None = None,
    ) -> list[Airport]:
        """Parse per-aerodrome chapter sections (id like "AD-2.LPPTdetails").

        Some eAIPs (CZ, PT, HU, IS) have NO aggregate "AD 2" menu section:
        every aerodrome is its own top-level chapter. ``section_re`` runs
        against the section div's id and must capture the ICAO code as
        group 1. ``title_prefix_re`` (default: the "AD 2.XXXX" chapter
        prefix) is stripped from the title anchor's text.
        """
        if title_prefix_re is None:
            title_prefix_re = _CHAPTER_TITLE_PREFIX_RE
        self.logger.info(
            f"Extracting per-chapter airports from {base_url} "
            f"(section id ~ {section_re.pattern!r})"
        )
        soup = self.soup(html)
        airports: list[Airport] = []

        # Each matching div is one aerodrome's chapter; group 1 = its ICAO code.
        for details in soup.find_all("div", attrs={"id": section_re}):
            match = section_re.search(details["id"])
            if not match:  # pragma: no cover - find_all already matched
                continue
            icao = match.group(1)

            # Title lives in the sibling div right before the details div,
            # e.g. <a>AD 2.LKPR PRAHA/Ruzyně</a>.
            # Default to the bare ICAO; upgrade to "<name> <ICAO>" if the
            # sibling title div yields a real name.
            title = icao
            title_div = details.find_previous_sibling("div")
            if isinstance(title_div, Tag):
                anchors = title_div.find_all("a")
                if anchors:
                    # Last anchor holds the human title, e.g. "AD 2.LKPR PRAHA".
                    raw = anchors[-1].get_text(" ", strip=True)
                    raw = re.sub(r"\s+", " ", raw).strip()
                    # Drop hidden annotation tokens (contain ";") and the
                    # chapter prefix, then de-duplicate a leading ICAO.
                    raw = " ".join(t for t in raw.split() if ";" not in t)
                    rest = title_prefix_re.sub("", raw).strip()
                    tokens = rest.split()
                    # Drop a leading ICAO token, tolerating a footnote marker
                    # (Slovenia's AD 4 menu labels ICAOs like "LJAJ*").
                    if tokens and tokens[0].rstrip("*") == icao:
                        tokens = tokens[1:]
                    rest = " ".join(tokens).strip()
                    if rest:
                        title = f"{rest} {icao}"

            # A chapter with no resolvable charts link is unusable - skip it
            # (unlike the aggregate path, a single field missing is not fatal).
            charts_url = self._find_charts_url(details, base_url)
            if charts_url is None:
                self.logger.warning(
                    f"{self.country}: no charts link for {icao}; skipping"
                )
                continue

            airports.append(
                Airport(
                    country=self.country,
                    icao=icao,
                    title=title,
                    url=charts_url,
                    type=category,
                )
            )

        if not airports:
            # Diagnostic: list the ids that DO exist so a failed live run
            # tells us the real chapter ids without needing the saved HTML.
            candidates = sorted(
                {
                    el["id"]
                    for el in soup.find_all(attrs={"id": True})
                    if "details" in el["id"].lower()
                }
            )[:60]
            raise ValueError(
                f"No per-chapter sections matching {section_re.pattern!r} "
                f"in {base_url}. Available *details ids: {candidates}"
            )
        return airports

    def _parse_pair(
        self,
        title_div: Tag,
        details_div: Tag,
        base_url: str,
        category: AirportType,
    ) -> Airport | None:
        """Turn one (title div, details div) pair into an Airport, or None.

        Returns None when the pair is not a real aerodrome entry: no title
        anchor, an empty label, or no chart link in the details div.
        """
        anchors = title_div.find_all("a")
        if not anchors:
            return None

        # Title: take the last <a>'s visible text (mirrors the Selenium
        # `innerText` behaviour closely enough for this content - these
        # pages have no display:none nodes inside the title link).
        raw_title = anchors[-1].get_text(separator=" ", strip=True)
        raw_title = raw_title.replace("—", "")
        raw_title = re.sub(r"\s+", " ", raw_title).strip()
        # eAIP menus embed hidden annotation tokens in the anchor text -
        # `TAD_HP;TXT_NAME;NNNN` (UK), `TCITY;CUSTOM_ATT7;175` (NO),
        # `TAD_HP;Annotation:113806.cze;2685` (CZ). No legitimate title
        # contains a semicolon, so drop every token that does.
        raw_title = " ".join(
            t for t in raw_title.split() if ";" not in t
        ).strip()
        if not raw_title:
            return None

        # First token is the ICAO code iff it is exactly four letters.
        parts = raw_title.split(" ")
        icao_candidate = parts[0].upper()
        if re.fullmatch(r"[A-Z]{4}", icao_candidate):
            icao: str | None = icao_candidate
            title_rest = " ".join(parts[1:]).strip()
        else:
            # No ICAO location indicator (some small aerodromes / heliports
            # are listed by name only). Keep the whole label as the title
            # rather than emitting a bogus, non-ICAO "code".
            icao = None
            title_rest = raw_title

        charts_url = self._find_charts_url(details_div, base_url)
        if charts_url is None:
            return None

        # Canonical display form is "<name> <ICAO>"; name-only when no ICAO.
        title = f"{title_rest} {icao}".strip() if icao else title_rest
        # Guard: a chart-designator / boilerplate "name" (NL "<ICAO> VAC")
        # means the menu anchor is not the aerodrome name - log the raw markup
        # so the right anchor can be identified, and flag it for the launch check.
        if title_name_looks_bad(title_rest):
            self.logger.warning(
                f"{self.country}: suspicious title {title!r} (name "
                f"{title_rest!r}); title_div: {title_div.decode()[:2000]}"
            )
        return Airport(
            country=self.country,
            icao=icao,
            title=title,
            url=charts_url,
            type=category,
        )

    @staticmethod
    def _find_charts_url(details_div: Tag, base_url: str) -> str | None:
        """Resolve the field's chart page URL from its details div, or None.

        The eAIP tags the wanted link with title="Charts related to an
        aerodrome" (or, on Portuguese-only manuals like the PT eVFR, "Cartas
        relacionadas com o aeródromo"); when that tagging is missing we fall
        back to the last inner link, which in this menu layout is the AD-2
        charts entry.
        """
        # Prefer the explicitly-tagged "Charts related to an aerodrome" link
        # (English eAIPs) or its Portuguese equivalent (PT eVFR manual).
        for a in details_div.select("div a[title]"):
            title_attr = a.get("title", "").lower()
            if "charts related" in title_attr or "cartas relacionad" in title_attr:
                href = a.get("href")
                if href:
                    return urljoin(base_url, href)

        # Fallback: last `<a>` directly under one of the inner <div>s.
        candidates = details_div.select("div > a[href]")
        if candidates:
            href = candidates[-1].get("href")
            if href:
                return urljoin(base_url, href)

        return None
