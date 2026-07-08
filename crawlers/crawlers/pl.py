from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "PL"
# PANSA (Polska Agencja Żeglugi Powietrznej / Polish Air Navigation Services
# Agency) AIS eAIP. The public entry point is https://www.ais.pansa.pl/; the
# eAIP itself is a EUROCONTROL-style static frameset. The exact index path
# below is a BEST-EFFORT guess and MUST be verified against the live site.
# PANSA publishes the eAIP behind a hub page that links the current
# editions (separate IFR / VFR / MIL volumes since AIRAC 04/25). The hub
# is scanned for the current VFR volume; see the live-crawl test for the
# resolved link diagnostics.
ROOT_URL = "https://www.ais.pansa.pl/en/publications/eaip/"
# Known historic direct entry points, tried when the hub yields no link.
_FALLBACK_ENTRY_URLS = [
    "https://www.ais.pansa.pl/aip/aip.html",
]


class PL(HttpEurocontrolBase):
    """Poland AIP crawler — BEST-EFFORT / UNVERIFIED (no task spec).

    There is no task spec for Poland, so both the endpoint and the extraction
    rules below are assumptions modelled on the Netherlands crawler and MUST be
    validated against the live PANSA eAIP before enabling this crawler:

      * ``ROOT_URL`` — the real PANSA eAIP index URL / current-edition entry
        point. PANSA may front the eAIP behind a dated-edition landing page (as
        LVNL/NATS do); if so, resolve the effective edition first (see nl.py's
        ``_resolve_edition_url``) before walking the frame chain.
      * The frame names passed to ``follow_frame_chain`` — the standard
        EUROCONTROL frameset uses ``eAISNavigationBase`` → ``eAISNavigation``,
        but this must be confirmed for the PL eAIP.
      * The menu section-id suffixes passed to
        ``extract_airports_from_html`` — ``"AD 2en-GBdetails"`` (aerodromes) and
        ``"AD 3en-GBdetails"`` (heliports). Different eAIP builds vary the exact
        id text (spacing / locale suffix); adjust after inspecting a saved
        ``eAISNavigation`` document.

    Type mapping (per the shared spec for spec-less countries):
        AD-2 → vfr, AD-3 → heliport.

    Import-clean: no network work happens at import or in ``__init__``.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def _resolve_entry_url(self, base_url: str, html: str) -> str:
        """Pick the current eAIP volume link off the PANSA hub page.

        Preference order: a link whose text/href mentions VFR + AIP, then any
        eAIP/AIP html link, then the hub itself (in case the hub already IS
        the frameset).
        """
        import re as _re
        from urllib.parse import urljoin as _urljoin

        soup = self.soup(html)
        links = [
            (a.get_text(" ", strip=True) or "", a["href"])
            for a in soup.find_all("a", href=True)
        ]

        def pick(pattern: str) -> str | None:
            rx = _re.compile(pattern, _re.I)
            for text, href in links:
                if rx.search(text) or rx.search(href):
                    return _urljoin(base_url, href)
            return None

        # Exclude the hub's own aliases (/publikacje/eaip/, /publications/eaip/)
        # - round 2 resolved to the Polish alias of the same hub page.
        links = [
            (text, href)
            for text, href in links
            if not _re.search(r"/(publikacje|publications)/eaip/?$", href)
        ]

        def pick(pattern: str) -> str | None:  # rebind over filtered links
            rx = _re.compile(pattern, _re.I)
            for text, href in links:
                if rx.search(text) or rx.search(href):
                    return _urljoin(base_url, href)
            return None

        entry = (
            pick(r"e?aip[^a-z]*vfr|vfr[^a-z]*e?aip")
            or pick(r"/aip/.*\.html")
            or pick(r"e?-?aip.*\.html")
        )
        if entry:
            self.logger.info(f"PL eAIP entry resolved: {entry}")
            return entry

        self.logger.warning(
            "PL: no eAIP volume link found on hub; trying known fallbacks"
        )
        self.log_candidate_links(html, base_url, limit=60, contains=r"aip|airac")
        for candidate in _FALLBACK_ENTRY_URLS:
            try:
                self.fetch(candidate)
                self.logger.info(f"PL fallback entry reachable: {candidate}")
                return candidate
            except Exception:
                continue
        return base_url

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. Resolve the current eAIP volume link from the hub page. Prefer
            #    the VFR volume (PL exposes vfr + heliport); fall back to any
            #    eAIP/AIP html link, then to the hub itself.
            hub_html = self.fetch(ROOT_URL)
            last_url, last_html = ROOT_URL, hub_html
            entry_url = self._resolve_entry_url(ROOT_URL, hub_html)

            # 2. Walk the frame chain to the navigation HTML.
            nav_url, nav_html = self.follow_frame_chain(
                entry_url, ["eAISNavigationBase", "eAISNavigation"]
            )
            last_url, last_html = nav_url, nav_html

            # 3. Extract aerodromes (AD 2 → vfr) and heliports (AD 3 → heliport).
            airports.extend(
                self.extract_airports_from_html(
                    nav_html, nav_url, "AD 2en-GBdetails", "vfr"
                )
            )
            airports.extend(
                self.extract_airports_from_html(
                    nav_html, nav_url, "AD 3en-GBdetails", "heliport"
                )
            )
        except Exception as e:
            self.logger.error(f"PL crawl failed: {e}")
            if last_html is not None:
                self.log_candidate_links(
                    last_html, last_url, limit=60, contains=r"aip|airac"
                )
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
