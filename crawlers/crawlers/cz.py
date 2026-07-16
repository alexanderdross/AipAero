import re
from urllib.parse import urljoin

from bs4 import Tag

from crawlers.http_base import Airport, current_airac_date
from crawlers.http_eurocontrol_base import HttpEurocontrolBase
from crawlers.models import ChartLink

COUNTRY = "CZ"
ROOT_URL = "https://aim.rlp.cz/eaip/html/index-en-GB.html"

# ---- VFR Manual (separate source) -------------------------------------------
# The CZ eAIP above carries only the ~11 IFR aerodromes. The many small VFR
# fields live in a SEPARATE publication, the ANS CR "VFR Manual" (VFR
# příručka), a static HTML site on the same host. Part 3 (VFR-AD) is the
# aerodrome directory: `ad_2_en.html` is an ICAO table whose every code links
# a per-field page `<icao>_text_en.html`, and each field page exposes a
# "Charts" map PDF (`pdf/ad-<icao>_map_en.pdf`) + a "Text" PDF. We harvest
# these as type "vfr" and merge them with the eAIP IFR aerodromes in crawl()
# (one crawler must own country CZ - the API delete+inserts per country, so a
# second crawler POSTing CZ would wipe the first's rows).
# ad_1_en.html carries the manual's PERSISTENT field directory - a single
# nav listing every field's detail page in section order: first the VFR
# AERODROMES (4-letter LKxx), then the SLZ ultralight fields (a contiguous
# block of non-standard 6-letter LK codes, per the manual's Note 3), then the
# HELIPORTS (4-letter LKxx, the private + HEMS list). We split by that order:
# fields before the SLZ block are aerodromes, the SLZ block + the aerodromes
# stay type "vfr", and fields after the SLZ block are heliports.
VFR_MANUAL_AD_INDEX = "https://aim.rlp.cz/vfrmanual/actual/ad_1_en.html"
# A per-field detail page in the manual: "<icao>_text_en.html" (lowercase);
# excludes supplements (sup####_en.html) and chapters (gen_N_en.html).
_VFR_FIELD_HREF_RE = re.compile(r"^([a-z0-9]+)_text_en\.html$", re.I)
# The per-field aerodrome map PDF (the "Charts" link) - the primary chart.
_VFR_MAP_PDF_RE = re.compile(r"_map_en\.pdf$", re.I)
# A real 4-letter Czech location indicator (LKxx). SLZ ultralight fields use a
# non-standard 6-letter LK code (not a valid ICAO for facts lookup), which
# ALSO marks the start of the SLZ block in the directory order.
_LK_ICAO_RE = re.compile(r"^LK[A-Z]{2}$")
# Field-page heading -> the field name: "LKTB - BRNO/Tuřany Public..." - the
# name is between "<CODE> -" and the class descriptor that follows it.
_VFR_TITLE_RE = re.compile(
    r"-\s*(.+?)\s+(?:INFO|Public|Private|Non-public|Domestic|International"
    r"|Sport|SLZ|Heliport|heliport|Emergency)",
)
_VFR_MAX_CHARTS = 50

# The CZ eAIP menu has NO aggregate "AD 2" section: every aerodrome is its own
# top-level chapter with an id like "AD-2.LKPRdetails" (verified via the
# live-crawl test diagnostics). We therefore iterate the per-airport sections
# directly instead of using the aggregate-section parser.
_AIRPORT_SECTION_RE = re.compile(r"AD-2\.([A-Z]{4})details$")
# Title anchors look like "AD 2.LKPR PRAHA/Ruzyně" - strip the chapter prefix.
_TITLE_PREFIX_RE = re.compile(r"^AD\s*2\.[A-Z]{4}\s*", re.I)


class CZ(HttpEurocontrolBase):
    """Czechia (Česko) AIP crawler.

    ANS CR / RLP serves the standard eurocontrol frameset eAIP at
    `aim.rlp.cz`. ``index-en-GB.html`` is the frameset entry point itself
    (no separate edition-picker landing page), so we walk the frame chain
    straight to the navigation HTML.

    Unlike NL/UK/FR, the CZ menu lists each aerodrome as its own chapter
    ("AD 2.LKPR PRAHA/Ruzyně" with section id ``AD-2.LKPRdetails``), so the
    airports are extracted per-section. Per the CZ task spec
    (crawlers/tasks/crawler_czech.md) every aerodrome is emitted as type
    "ifr" and the URL is the "Charts related to the aerodrome" link.

    The eAIP carries ONLY these ~11 IFR aerodromes. Czechia's many small VFR
    fields (and SLZ ultralight fields) live in a separate publication, the ANS
    CR VFR Manual, which :meth:`_crawl_vfr_manual` harvests as type "vfr";
    ``crawl`` returns both sets together (see that method and
    VFR_MANUAL_AD_INDEX above). The manual's heliports are skipped for now.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _extract_airport_sections(
        self, nav_html: str, nav_url: str
    ) -> list[Airport]:
        """Emit one IFR Airport per aerodrome chapter in the CZ nav menu.

        The CZ eAIP has no aggregate AD 2 list, so instead of the base's
        aggregate-section parser we scan every per-aerodrome details div
        (``id="AD-2.<ICAO>details"``): the id yields the ICAO, the sibling
        title div gives the display name, and the "Charts related to the
        aerodrome" link becomes the airport URL. Raises ValueError when no
        such sections are found (markup drift / wrong nav page) so the crawl
        fails loud rather than silently publishing an empty country.
        """
        soup = self.soup(nav_html)
        airports: list[Airport] = []

        # Each aerodrome is its own chapter; the regex-matched id both selects
        # the section and carries the ICAO in its capture group.
        for details in soup.find_all(
            "div", attrs={"id": _AIRPORT_SECTION_RE}
        ):
            match = _AIRPORT_SECTION_RE.search(details["id"])
            if not match:  # pragma: no cover - find_all already matched
                continue
            icao = match.group(1)

            # Title lives in the sibling div right before the details div,
            # e.g. <a>AD 2.LKPR PRAHA/Ruzyně</a>.
            title = icao
            title_div = details.find_previous_sibling("div")
            if isinstance(title_div, Tag):
                anchors = title_div.find_all("a")
                if anchors:
                    raw = anchors[-1].get_text(" ", strip=True)
                    raw = re.sub(r"\s+", " ", raw).strip()
                    # Drop hidden annotation tokens (contain ";") and the
                    # chapter prefix, then de-duplicate a leading ICAO.
                    raw = " ".join(t for t in raw.split() if ";" not in t)
                    rest = _TITLE_PREFIX_RE.sub("", raw).strip()
                    tokens = rest.split()
                    if tokens and tokens[0] == icao:
                        tokens = tokens[1:]
                    rest = " ".join(tokens).strip()
                    if rest:
                        title = f"{rest} {icao}"

            # The AIP page URL is the aerodrome's "Charts related to the
            # aerodrome" link (per the CZ task spec); skip the field if the
            # menu row has none to point at.
            charts_url = self._find_charts_url(details, nav_url)
            if charts_url is None:
                self.logger.warning(
                    f"CZ: no charts link for {icao}; skipping"
                )
                continue

            airports.append(
                Airport(
                    country=self.country,
                    icao=icao,
                    title=title,
                    url=charts_url,
                    type="ifr",
                )
            )

        if not airports:
            raise ValueError(
                f"No per-airport AD-2 sections found in {nav_url}"
            )
        return airports

    # Chart-PDF extraction (recon 2026-07-12): semantic hrefs like
    # a2-tb-vfrc.pdf (VFR chart) / a2-tb-adc.pdf (aerodrome chart).
    FETCH_PDF_URLS = True
    PDF_HREF_PRIORITY = (r"-vfrc\.pdf$", r"-adc\.pdf$")

    # ---- VFR Manual harvest --------------------------------------------------

    def _vfr_field_title(self, page_html: str, code: str) -> str:
        """The field's name from its own detail page.

        The page repeats "<CODE> - <Name>" then a class descriptor
        ("LKTB - BRNO/Tuřany Public international aerodrome ..."); we anchor on
        the code (so we read THIS field's heading, not a neighbour named in
        the persistent directory nav) and take the text up to that descriptor.
        Empty when the heading is not found (the caller falls back to the code).
        """
        text = " ".join(self.soup(page_html).get_text(" ", strip=True).split())
        idx = text.find(f"{code} -")
        if idx == -1:
            idx = text.find(f"{code} –")  # en-dash variant
        if idx == -1:
            return ""
        match = _VFR_TITLE_RE.search(text[idx + len(code):])
        return re.sub(r"\s+", " ", match.group(1)).strip()[:80] if match else ""

    def _vfr_charts(
        self, page_html: str, page_url: str
    ) -> tuple[list[ChartLink], str | None]:
        """Every PDF a VFR-manual field page links, with the "Charts" map
        (`*_map_en.pdf`) chosen as the primary pdf_url (else the first PDF)."""
        charts: list[ChartLink] = []
        seen: set[str] = set()
        map_url: str | None = None
        for a in self.soup(page_html).find_all("a", href=True):
            href = a["href"].strip()
            if ".pdf" not in href.lower():
                continue
            url = urljoin(page_url, href)
            if url in seen:
                continue
            seen.add(url)
            name = " ".join(a.get_text(" ", strip=True).split())
            if not name:
                name = url.rsplit("/", 1)[-1][:-4]
            if len(charts) < _VFR_MAX_CHARTS:
                charts.append(ChartLink(name=name[:120], url=url))
            # The "Charts" link is the aerodrome map - the primary chart.
            if map_url is None and _VFR_MAP_PDF_RE.search(href):
                map_url = url
        primary = map_url or (charts[0].url if charts else None)
        return charts, primary

    def _crawl_vfr_manual(self) -> list[Airport]:
        """Harvest every field from the ANS CR VFR Manual (the VFR aerodromes,
        SLZ ultralight fields and heliports the IFR-only eAIP omits).

        The directory (VFR_MANUAL_AD_INDEX) lists all fields in section order,
        so the TYPE follows position: fields before the first 6-letter SLZ
        code are VFR aerodromes, the 6-letter block is the SLZ fields (also
        VFR), and every field after that block is a heliport. Each field's
        detail page yields its name + chart PDFs. Fully fail-soft: any failure
        logs and returns what was gathered, so a VFR-manual hiccup never
        aborts the CZ eAIP crawl.
        """
        airports: list[Airport] = []
        try:
            index_html = self.fetch(VFR_MANUAL_AD_INDEX)
        except Exception as e:
            self.logger.warning(f"CZ VFR manual: directory fetch failed: {e}")
            return airports

        # Field codes in directory order, de-duplicated.
        codes: list[str] = []
        seen: set[str] = set()
        for a in self.soup(index_html).find_all("a", href=True):
            match = _VFR_FIELD_HREF_RE.match(a["href"].strip())
            if not match:
                continue
            code = match.group(1).upper()  # "lktb" -> "LKTB"
            if code not in seen:
                seen.add(code)
                codes.append(code)

        # Take the VFR fields only: the AERODROMES (4-letter codes before the
        # SLZ block) plus the SLZ ultralight fields (the 6-letter block), both
        # type "vfr". The directory order is aerodromes -> SLZ -> heliports, so
        # once the SLZ block has been seen a 4-letter code marks the start of
        # the trailing HELIPORT block, which we skip (heliports would need
        # their own type + /cz/heliports page - a follow-up). `_LK_ICAO_RE`
        # matches only 4-letter codes, so a non-match is an SLZ code.
        vfr_codes: list[str] = []
        seen_slz = False
        for code in codes:
            is_four = bool(_LK_ICAO_RE.match(code))
            if seen_slz and is_four:
                break  # heliport block reached
            if not is_four:
                seen_slz = True
            vfr_codes.append(code)
        self.logger.info(
            f"CZ VFR manual: directory has {len(codes)} fields; taking "
            f"{len(vfr_codes)} VFR (aerodromes + SLZ), skipping the "
            f"{len(codes) - len(vfr_codes)} trailing heliports"
        )

        base = VFR_MANUAL_AD_INDEX.rsplit("/", 1)[0] + "/"
        for code in vfr_codes:
            field_url = urljoin(base, f"{code.lower()}_text_en.html")
            try:
                page_html = self.fetch(field_url)
            except Exception as e:
                self.logger.warning(
                    f"CZ VFR manual: {code} page fetch failed: {e}"
                )
                continue
            charts, pdf_url = self._vfr_charts(page_html, field_url)
            name = self._vfr_field_title(page_html, code)
            # Valid 4-letter LK code -> ICAO (drives facts enrichment); the
            # 6-letter SLZ codes are not valid ICAOs, so icao stays None and
            # the name carries the field's identity.
            icao = code if _LK_ICAO_RE.match(code) else None
            title = f"{name} {code}".strip() if name else code
            airports.append(
                Airport(
                    country=self.country,
                    icao=icao,
                    title=title,
                    url=field_url,
                    pdf_url=pdf_url,
                    charts=charts or None,
                    type="vfr",
                )
            )
        self.logger.info(
            f"CZ VFR manual: extracted {len(airports)} VFR fields "
            f"(eAIP IFR aerodromes are added separately)"
        )
        return airports

    def crawl(self) -> list[Airport]:
        """Walk the frameset to the nav menu, emit every aerodrome as IFR,
        then attach direct chart-PDF links. ``last_url``/``last_html`` track
        the most recent fetch so a failure can dump the offending page for
        post-mortem debugging via ``save_response``."""
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. Walk the frame chain from the frameset index to the nav HTML.
            nav_url, nav_html = self.follow_frame_chain(
                ROOT_URL, ["eAISNavigationBase", "eAISNavigation"]
            )
            last_url, last_html = nav_url, nav_html
            # ANS CR URLs carry no edition date; stamp the on-cycle AIRAC.
            self.airac = current_airac_date()

            # 2. One chapter per aerodrome; all are type "ifr" per the spec.
            airports.extend(self._extract_airport_sections(nav_html, nav_url))

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)

            # 3. Merge in the VFR Manual aerodromes (type "vfr"). These live in
            # a separate publication, so they are harvested and returned
            # together with the eAIP IFR fields - one crawler owns country CZ,
            # since the API delete+inserts per country. Fail-soft on its own.
            airports.extend(self._crawl_vfr_manual())
        except Exception as e:
            self.logger.error(f"CZ crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
