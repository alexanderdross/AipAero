"""Finland (Fintraffic ANS) eAIP crawler.

Source: Fintraffic ANS publishes a eurocontrol frameset eAIP behind an
amendment-stable `currently_effective` alias at `ais.fi`, so no edition picker
is needed - just resolve a working index file inside that folder.

FI SPECIAL CASE (chart PDFs): the AD 2.24 chart nodes are NOT in the airport's
menu `details_div`, so the base's charts-link match cannot reach them, and the
per-airport AD 2 sub-page the menu points at is the waypoints section (only
WPT_LIST/FAS_DB data PDFs). Every real chart instead lives on the single
full-aerodrome document page, numbered "1-fi-FI" for EVERY airfield. So after
extracting the aerodrome list, `crawl()` rewrites each airport's `url` to that
"1-fi-FI" page (see `_chart_index_url`) before `attach_pdf_urls` runs, and the
primary pdf_url is chosen by HREF preferring the VFR visual approach chart
(_VAC) then the aerodrome chart (_ADC).
"""

import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "FI"
# Fintraffic ANS publishes the eAIP under an amendment-stable alias - no
# edition picker needed (probe_eaip run 29256408808 saw section files under
# `/eaip/currently_effective/eAIP/EF-GEN 2.2-fi-FI.html`; filenames carry
# spaces like LVNL's). Candidate frameset entry points inside that folder,
# tried in order.
BASE_URL = "https://www.ais.fi/eaip/currently_effective/"
_INDEX_CANDIDATES = ["index-en-GB.html", "index.html", "index-fi-FI.html"]

_AD2_SECTION_IDS = ["AD 2en-GBdetails", "AD-2details", "AD 2details"]
_AD3_SECTION_IDS = ["AD 3en-GBdetails", "AD-3details", "AD 3details"]


class FI(HttpEurocontrolBase):
    """Finland AIP crawler (Fintraffic ANS eAIP, task spec:
    europe-expansion.md).

    Standard eurocontrol frameset eAIP behind the amendment-stable
    `currently_effective` alias. Aerodromes are emitted as "vfr" (same
    convention as NO/PL/SE), heliports fail-soft as "heliport".
    """

    # Stage 2: the eurocontrol menu points each airport at a numbered AD 2
    # sub-page (the base's fallback picks the last one, the waypoints section
    # "15-en-GB", which only links the WPT_LIST/FAS_DB data PDFs). The AD 2.24
    # charts, however, all live on the single full-aerodrome document page,
    # numbered "1-fi-FI" for EVERY airfield (verified in the menu, dump run
    # 29316929661) - that page links every ADC / VAC / IAC / approach chart as
    # ../documents/Root_WePub/ANSFI/Charts/AD/<ICAO>/EF_AD_2_<ICAO>_<TYPE>.pdf.
    # crawl() rewrites each url to that page before attach_pdf_urls runs. The
    # link text is empty (icon links), so prefer the VFR visual approach chart
    # (VAC) then the aerodrome chart (ADC) for the primary pdf_url by HREF.
    FETCH_PDF_URLS = True
    PDF_HREF_PRIORITY = (r"_VAC\.pdf", r"_ADC\.pdf")

    # `<sep><N>-<lang>.html[#anchor]` -> `<sep>1-fi-FI.html` (the full-doc
    # chart page). `<sep>` is the space before the section number, kept as-is
    # so a literal-space OR %20-encoded url is rewritten in kind.
    _CHART_PAGE_RE = re.compile(
        r"(\s+|(?:%20)+)\d+-[A-Za-z]{2}-[A-Za-z]{2}\.html(?:#.*)?$"
    )

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _chart_index_url(self, url: str) -> str:
        """Rewrite an AD 2 sub-page url to the full-aerodrome document page
        (section "1-fi-FI"), which carries every chart PDF link. Unchanged if
        the url does not match the expected pattern (fail-soft)."""
        rewritten, n = self._CHART_PAGE_RE.subn(r"\g<1>1-fi-FI.html", url)
        return rewritten if n else url

    def _resolve_index(self) -> str:
        """Return the first frameset index file that fetches OK under BASE_URL.

        The `currently_effective` folder's index filename varies (locale
        suffix / bare); try each candidate in order and use the first 200.
        """
        last_error: Exception | None = None
        for candidate in _INDEX_CANDIDATES:
            url = urljoin(BASE_URL, candidate)
            try:
                self.fetch(url)
                return url
            except Exception as e:  # 404 etc. - try the next candidate
                last_error = e
        raise ValueError(
            f"No eAIP index found under {BASE_URL} "
            f"(tried {_INDEX_CANDIDATES}): {last_error}"
        )

    def crawl(self) -> list[Airport]:
        """List aerodromes/heliports, then repoint each url at its chart page."""
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = BASE_URL
        last_html: str | None = None

        try:
            # Amendment-stable alias -> a working frameset index file.
            index_url = self._resolve_index()
            self.logger.info(f"FI edition index: {index_url}")

            nav_url, nav_html = self.follow_frame_chain(
                index_url, ["eAISNavigationBase", "eAISNavigation"]
            )
            last_url, last_html = nav_url, nav_html

            # AD 2 aerodromes (required); AD 3 heliports optional (fail-soft).
            # KNOWN ISSUE (owner directive 14.07.2026: keep heliports, fix the
            # names "like every other page"): 12 of 16 AD 3 entries came
            # through titled with the chart-section heading "AD 3.23
            # HELIKOPTERILENTOPAIKKAA KOSKEVAT KARTAT <ICAO>" instead of the
            # heliport name (prod D1 audit), while 4 (EFHY/EFFH/EFPJ/EFPT) had
            # real names - the menu DOES carry names, the generic anchors[-1]
            # pick just grabs the wrong anchor for most entries. The base's
            # title guard dumps the title_div markup for those on the next
            # live run; the anchor selection gets fixed from that markup.
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
                self.logger.info("FI: no AD 3 heliport section - skipping")

            # Fintraffic menu anchors read "AD 2 EFET - ENONTEKIÖ
            # AERONAUTICAL DATA", which the generic extractor turns into
            # "- ENONTEKIÖ AERONAUTICAL DATA EFET" - strip the boilerplate
            # so the title is "ENONTEKIÖ EFET" (live run 29257033060).
            for airport in airports:
                # Drop the "AERONAUTICAL DATA" boilerplate + leading "- " so the
                # title collapses to "<place name> <ICAO>".
                title = re.sub(
                    r"\s*AERONAUTICAL DATA", "", airport.title, flags=re.I
                )
                airport.title = title.lstrip(" -").strip()
                # Point the url at the full-aerodrome document page so it (and
                # attach_pdf_urls below) sees the AD 2.24 chart links, not just
                # the waypoints sub-page.
                airport.url = self._chart_index_url(airport.url)

            # Stage 2: capture direct chart-PDF links (fail-soft per field).
            self.attach_pdf_urls(airports)
        except Exception as e:
            self.logger.error(f"FI crawl failed: {e}")
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
        """Extract a menu section, trying each candidate id format in turn.

        eAIP menu ids vary by generator; return the first id that yields
        airports, re-raising the last error if none matched.
        """
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
