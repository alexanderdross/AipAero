import datetime
import re
from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "SI"
# Slovenia Control serves a classic eurocontrol eAIP, but the host sends
# the WRONG RapidSSL intermediate (crawlers/recon/probe-si.md): the
# pinned public DigiCert intermediate below completes the chain -
# verification stays fully enabled (use_extra_ca, never verify=False).
# The AMDT history page is the edition picker (probe run 29271294861).
ROOT_URL = "https://aim.sloveniacontrol.si/aim/eAIP/Operations/history-en-GB.html"
CA_PEM_URL = "https://cacerts.digicert.com/RapidSSLTLSRSACAG1.crt.pem"

# Edition entry links on the history page: live run 29272201936 shows
# bare "../Operations/<yyyy-mm-dd>-AIRAC/html/index.html" hrefs (no
# language suffix); the folder date picks the edition (NL/UK pattern).
# Edition entry filename (index.html / index-en-GB.html, any suffix).
_INDEX_HREF_RE = re.compile(r"index[-\w]*\.html?$", re.I)
# YYYY-MM-DD inside the edition href = its AIRAC effective date.
_DATE_RE = re.compile(r"(\d{4})-(\d{2})-(\d{2})")

# Aggregate AD 2 / AD 3 / AD 4 menu-section id variants (tried in order).
_AD2_SECTION_IDS = ["AD 2en-GBdetails", "AD-2details", "AD 2details"]
_AD3_SECTION_IDS = ["AD 3en-GBdetails", "AD-3details", "AD 3details"]
# Slovenia files its many small VFR aerodromes / airstrips under AD 4 (distinct
# from the AD 2 aerodromes) - the bulk of the country's fields live here.
_AD4_SECTION_IDS = ["AD 4en-GBdetails", "AD-4details", "AD 4details"]
# Per-airport chapter fallbacks (CZ/PT/HU/IS layouts): "AD <n>.<ICAO>...details".
_AD2_CHAPTER_RE = re.compile(r"AD[ -]2\.([A-Z]{4}).*details$")
_AD4_CHAPTER_RE = re.compile(r"AD[ -]4\.([A-Z]{4}).*details$")

# Frameset layouts to try when entering the nav frame (base+nav, or nav only).
_FRAME_CHAINS = (
    ["eAISNavigationBase", "eAISNavigation"],
    ["eAISNavigation"],
)


class SI(HttpEurocontrolBase):
    """Slovenia AIP crawler (Slovenia Control eAIP, task spec:
    europe-expansion.md).

    TLS needs the pinned RapidSSL intermediate (broken server chain).
    The AMDT history page links each edition's ``index-en-GB.html``;
    the frameset chain and AD-2 section layout are resolved from
    candidate lists with the base's diagnostics on a miss. Aerodromes
    are "vfr" (new-country convention), heliports fail-soft.
    """

    # Chart-PDF extraction (recon run 29273393673, crawlers/recon/
    # pdf-recon-si.md): positional AD 2.24 numbering like PT, e.g.
    # LJ_AD_2_LJLJ_01-1_en.pdf - chart 01 is the aerodrome chart on all
    # sampled fields. Add a VAC-number pattern IN FRONT once the VAC's
    # chart number is verified by opening one PDF.
    FETCH_PDF_URLS = True
    # Prefer the positional aerodrome chart (…_01-1_en.pdf) among AD 2.24 links.
    PDF_HREF_PRIORITY = (r"_01-1_en\.pdf$",)

    def __init__(self) -> None:
        # No network in __init__ (same rule as the lazy Playwright import):
        # the CA fetch happens at the start of crawl(), so importing /
        # instantiating SI never needs egress (CI import smoke test).
        super().__init__(COUNTRY)

    def _resolve_edition_entry(
        self, html: str, today: datetime.date | None = None
    ) -> str:
        """Pick the effective edition's index page from the AMDT history page.

        Splits the `index*.html` links into date-tagged and undated: prefers
        the latest dated edition on/before ``today`` (earliest if all future),
        else the first undated link; raises with a diagnostic href dump if the
        page links no edition at all.
        """
        today = today or datetime.date.today()
        soup = self.soup(html)
        dated: list[tuple[datetime.date, str]] = []
        undated: list[str] = []
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if not _INDEX_HREF_RE.search(href):
                continue
            url = urljoin(ROOT_URL, href)
            # A YYYY-MM-DD in the href dates the edition; keep undated ones too.
            m = _DATE_RE.search(href)
            if m:
                try:
                    dated.append(
                        (datetime.date(*(int(g) for g in m.groups())), url)
                    )
                    continue
                except ValueError:
                    pass
            undated.append(url)
        if dated:
            in_effect = [c for c in dated if c[0] <= today]
            effective, url = (
                max(in_effect, key=lambda c: c[0])
                if in_effect
                else min(dated, key=lambda c: c[0])
            )
            self.logger.info(f"SI edition (effective {effective}): {url}")
            return url
        if undated:
            self.logger.info(f"SI edition (first listed): {undated[0]}")
            return undated[0]
        # Diagnostics: show what the history page actually links.
        hrefs = [a["href"][:120] for a in soup.find_all("a", href=True)][:40]
        raise ValueError(
            f"No index-en-GB.html edition links in {ROOT_URL}. Hrefs: {hrefs}"
        )

    def _enter_nav(self, entry: str) -> tuple[str, str]:
        """Enter the nav frame, trying each frame-chain layout in turn.

        Returns the first chain that resolves to the navigation HTML; re-raises
        the last error if none of the known layouts match.
        """
        last_error: Exception | None = None
        for chain in _FRAME_CHAINS:
            try:
                return self.follow_frame_chain(entry, chain)
            except Exception as e:
                last_error = e
        assert last_error is not None
        raise last_error

    def crawl(self) -> list[Airport]:
        """History page -> effective edition -> nav frame -> AD 2 (+ AD 3).

        `use_extra_ca` pins the correct DigiCert intermediate FIRST (the host
        serves a broken chain, so a plain fetch would fail TLS verification);
        it runs here in crawl(), not __init__, to keep import egress-free.
        AD 2 aerodromes are "vfr" with a per-airport-chapter fallback; AD 3
        heliports are optional and fail-soft. Last page dumped on failure.
        """
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # Pin the correct intermediate CA before any HTTPS fetch to this
            # host (verification stays ON - never verify=False).
            self.use_extra_ca(CA_PEM_URL)
            history = self.fetch(ROOT_URL)
            last_html = history
            entry = self._resolve_edition_entry(history)

            nav_url, nav_html = self._enter_nav(entry)
            last_url, last_html = nav_url, nav_html

            # Primary: aggregate AD 2 section. Fall back to per-airport
            # chapters if this eAIP uses the CZ/PT/HU/IS chapter layout.
            try:
                airports.extend(
                    self._extract_section(
                        nav_html, nav_url, _AD2_SECTION_IDS, "vfr"
                    )
                )
            except ValueError as e:
                self.logger.warning(
                    f"SI: aggregate AD 2 parse failed ({e}); "
                    "trying per-airport chapters"
                )
                airports.extend(
                    self.extract_airports_per_chapter(
                        nav_html, nav_url, _AD2_CHAPTER_RE, "vfr"
                    )
                )
            try:
                airports.extend(
                    self._extract_section(
                        nav_html, nav_url, _AD3_SECTION_IDS, "heliport"
                    )
                )
            except ValueError:
                self.logger.info("SI: no AD 3 heliport section - skipping")

            # AD 4: Slovenia's small VFR aerodromes / airstrips (the bulk of the
            # country's fields) - aggregate section, per-chapter fallback, all
            # "vfr", fail-soft. Deduped by ICAO against AD 2 below.
            try:
                airports.extend(
                    self._extract_section(
                        nav_html, nav_url, _AD4_SECTION_IDS, "vfr"
                    )
                )
            except ValueError:
                try:
                    airports.extend(
                        self.extract_airports_per_chapter(
                            nav_html, nav_url, _AD4_CHAPTER_RE, "vfr"
                        )
                    )
                except ValueError:
                    self.logger.info("SI: no AD 4 section - skipping")

            # Dedup by ICAO (a field must not appear twice if it is listed in
            # both AD 2 and AD 4); keep the first (AD 2) occurrence.
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
            self.logger.error(f"SI crawl failed: {e}")
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
