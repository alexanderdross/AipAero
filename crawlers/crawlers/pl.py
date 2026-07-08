import re
from urllib.parse import urljoin

from bs4 import Tag

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "PL"
# PANSA (Polska Agencja Żeglugi Powietrznej / Polish Air Navigation Services
# Agency) AIS eAIP. The public entry point is https://www.ais.pansa.pl/; the
# eAIP itself is a EUROCONTROL-style static frameset hosted on
# docs.pansa.pl. The hub chain is verified live (round 7/8): EN hub ->
# "AIP Poland" product page -> https://docs.pansa.pl/ais/eaipvfr/
# default_offline_<date>.html -> dated AIRAC folder -> classic index.html
# frameset -> eAIP/menu.html.
ROOT_URL = "https://www.ais.pansa.pl/en/publications/eaip/"
# Known historic direct entry points, tried when the hub yields no link.
_FALLBACK_ENTRY_URLS = [
    "https://www.ais.pansa.pl/aip/aip.html",
]

# Redirect / hop patterns used to hunt the frameset from the resolved entry
# page. Round 7 resolved the entry to
# https://docs.pansa.pl/ais/eaipvfr/default_offline_2026-06-11.html (HTTP 200)
# which is NOT itself a frameset ("Available frames: []"), so the frameset
# must be one or two hops further (meta refresh, JS redirect, an index*.html
# or dated-AIRAC link, or a classic index file next to the entry page).
_META_REFRESH_URL_RE = re.compile(r"url=([^;]+)", re.I)
_JS_LOCATION_RE = re.compile(
    r"""location(?:\.href)?\s*=\s*['"]([^'"]+)['"]""", re.I
)
_INDEX_HREF_RE = re.compile(
    r"index(?:[-_][A-Za-z]{2}-[A-Za-z]{2})?\.html$", re.I
)
_DATED_HREF_RE = re.compile(r"\d{4}[-_]\d{2}[-_]\d{2}.*\.html?$", re.I)
# Classic eurocontrol index files that may sit next to the entry page.
_SIBLING_PROBES = (
    "index.html",
    "html/index-en-GB.html",
    "html/index-pl-PL.html",
    "html/index.html",
)

# The PL AIP VFR menu has NO aggregate "AD 2"/"AD 3" section: each airfield is
# its own "AD 4 <ICAO>" chapter (verified via the round-8 live-crawl
# diagnostics: ids like "AD 4 EPBAen-GBdetails" plus numbered subsections
# "AD 4 EPBA 1en-GBdetails" ... - the en-GB/pl-PL variants both exist, we key
# on en-GB only to avoid duplicates).
_AIRPORT_SECTION_RE = re.compile(r"AD 4 ([A-Z]{4})en-GBdetails$")
# Title anchors look like "AD 4 EPBA BIELSKO-BIAŁA ..." - strip the prefix.
_TITLE_PREFIX_RE = re.compile(r"^AD\s*4\s*[A-Z]{4}\s*", re.I)
# The charts subsection link, English first ("... CHARTS ..."), then Polish
# ("MAPY ...").
_CHARTS_TEXT_RES = (
    re.compile(r"CHARTS?", re.I),
    re.compile(r"MAPY", re.I),
)


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

        # The EN hub only aliases the Polish page - the actual volume links
        # live there. Scan it as a second level before giving up.
        try:
            pl_url = "https://www.ais.pansa.pl/publikacje/eaip/"
            pl_html = self.fetch(pl_url)
            pl_soup = self.soup(pl_html)
            links = [
                (a.get_text(" ", strip=True) or "", a["href"])
                for a in pl_soup.find_all("a", href=True)
                if not _re.search(r"/(publikacje|publications)/eaip/?$", a["href"])
            ]
            entry = (
                pick(r"e?aip[^a-z]*vfr|vfr[^a-z]*e?aip")
                or pick(r"/aip/.*\.html")
                or pick(r"e?-?aip.*\.html")
                or pick(r"airac.*\.html|\.html.*airac")
            )
            if entry:
                self.logger.info(f"PL eAIP entry (via PL page): {entry}")
                return entry
            self.logger.warning("PL: Polish alias page has no volume link either")
            self.log_candidate_links(pl_html, pl_url, limit=60, contains=r"aip|airac|html")
        except Exception as e:
            self.logger.warning(f"PL: alias-page scan failed: {e}")

        # Third level: the "AIP Poland" product page is the only remaining
        # candidate that could carry the volume links.
        for page_url in (
            "https://www.ais.pansa.pl/en/publications/aip-poland/",
            "https://www.ais.pansa.pl/publikacje/aip-polska/",
        ):
            try:
                page_html = self.fetch(page_url)
                page_soup = self.soup(page_html)
                links = [
                    (a.get_text(" ", strip=True) or "", a["href"])
                    for a in page_soup.find_all("a", href=True)
                ]
                entry = (
                    pick(r"e?aip[^a-z]*vfr|vfr[^a-z]*e?aip")
                    or pick(r"/aip/.*\.html")
                    or pick(r"e?-?aip.*\.html")
                )
                if entry:
                    self.logger.info(f"PL eAIP entry (via {page_url}): {entry}")
                    return entry
                self.log_candidate_links(
                    page_html, page_url, limit=60, contains=r"aip|airac|html|pdf"
                )
            except Exception as e:
                self.logger.warning(f"PL: scan of {page_url} failed: {e}")

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

    def _has_frames(self, html: str) -> bool:
        soup = self.soup(html)
        return any(
            f.get("name") or f.get("src")
            for f in soup.find_all(["frame", "iframe"])
        )

    def _frameset_candidates(
        self, base_url: str, html: str, seen: set[str]
    ) -> list[str]:
        """Ordered next-hop candidates towards the frameset, best first."""
        soup = self.soup(html)
        candidates: list[str] = []

        def add(raw: str) -> None:
            cand = urljoin(base_url, raw.replace("\\", "/"))
            if cand not in seen and cand not in candidates:
                candidates.append(cand)

        # 1. Explicit redirects (meta refresh, JS location).
        meta = soup.find(
            "meta", attrs={"http-equiv": re.compile("refresh", re.I)}
        )
        if meta and meta.get("content"):
            m = _META_REFRESH_URL_RE.search(meta["content"])
            if m:
                add(m.group(1).strip().strip("'\""))
        m = _JS_LOCATION_RE.search(html)
        if m:
            add(m.group(1))

        # 2. index*.html links, then dated AIRAC-edition links.
        for rx in (_INDEX_HREF_RE, _DATED_HREF_RE):
            for a in soup.find_all("a", href=True):
                href = a["href"].split("#")[0].split("?")[0]
                if rx.search(href.replace("\\", "/")):
                    add(a["href"])

        # 3. Classic index files that may sit next to the entry page.
        for suffix in _SIBLING_PROBES:
            add(suffix)

        return candidates[:8]

    def _find_frameset(
        self, url: str, html: str, hops: int = 3
    ) -> tuple[str, str]:
        """Follow redirects / index links until a page with frames appears.

        The docs.pansa.pl entry page (default_offline_<date>.html) is not a
        frameset itself (verified live, round 7), so hunt up to `hops` levels
        deep. Candidates on each level are tried for frames directly; the
        first fetchable one becomes the next level's base if none has frames.
        """
        seen: set[str] = {url}
        cur_url, cur_html = url, html
        for _ in range(hops):
            if self._has_frames(cur_html):
                return cur_url, cur_html
            next_hop: tuple[str, str] | None = None
            for cand in self._frameset_candidates(cur_url, cur_html, seen):
                seen.add(cand)
                try:
                    cand_html = self.fetch(cand)
                except Exception:
                    continue
                if self._has_frames(cand_html):
                    self.logger.info(f"PL frameset found: {cand}")
                    return cand, cand_html
                if next_hop is None:
                    next_hop = (cand, cand_html)
            if next_hop is None:
                break
            self.logger.info(f"PL: no frameset yet; descending via {next_hop[0]}")
            cur_url, cur_html = next_hop
        self.logger.warning(f"PL: no frameset found within {hops} hops of {url}")
        return cur_url, cur_html

    def _charts_link(self, details: Tag, base_url: str) -> str | None:
        """Pick the charts subsection link inside an AD 4 chapter."""
        for rx in _CHARTS_TEXT_RES:
            for a in details.find_all("a", href=True):
                text = a.get_text(" ", strip=True)
                title_attr = a.get("title") or ""
                if rx.search(text) or rx.search(title_attr):
                    return urljoin(base_url, a["href"])
        return self._find_charts_url(details, base_url)

    def _extract_airport_sections(
        self, nav_html: str, nav_url: str
    ) -> list[Airport]:
        """Extract one airport per "AD 4 <ICAO>" chapter (cf. CZ/BE)."""
        soup = self.soup(nav_html)
        airports: list[Airport] = []
        seen: set[str] = set()

        for details in soup.find_all("div", attrs={"id": _AIRPORT_SECTION_RE}):
            match = _AIRPORT_SECTION_RE.search(details["id"])
            if not match:  # pragma: no cover - find_all already matched
                continue
            icao = match.group(1)
            # The menu carries each chapter twice (Polish and English
            # subtree, verified round 9: every ICAO was emitted twice).
            if icao in seen:
                continue
            seen.add(icao)

            # Title lives in the sibling div right before the details div.
            title = icao
            title_div = details.find_previous_sibling("div")
            if isinstance(title_div, Tag):
                anchors = title_div.find_all("a")
                if anchors:
                    raw = anchors[-1].get_text(" ", strip=True)
                    raw = re.sub(r"\s+", " ", raw).strip()
                    # Drop hidden annotation tokens (contain ";"), the
                    # chapter prefix, and a duplicated leading ICAO.
                    raw = " ".join(t for t in raw.split() if ";" not in t)
                    rest = _TITLE_PREFIX_RE.sub("", raw).strip()
                    tokens = rest.split()
                    if tokens and tokens[0] == icao:
                        tokens = tokens[1:]
                    rest = " ".join(tokens).strip()
                    if rest:
                        title = f"{rest} {icao}"

            charts_url = self._charts_link(details, nav_url)
            if charts_url is None:
                self.logger.warning(f"PL: no charts link for {icao}; skipping")
                continue

            airports.append(
                Airport(
                    country=self.country,
                    icao=icao,
                    title=title,
                    url=charts_url,
                    # The AIP VFR AD 4 chapters list VFR airfields.
                    type="vfr",
                )
            )

        if not airports:
            raise ValueError(f"No per-airport AD 4 sections found in {nav_url}")
        return airports

    def _enrich_titles(
        self, airports: list[Airport], nav_html: str, nav_url: str
    ) -> None:
        """Fill in airfield names from the "AD 1" index page.

        The AD 4 menu anchors carry only "AD 4 <ICAO>" (no airfield name,
        verified round 9), but the menu links an index page ("AD 1 INDEX TO
        AERODROMES AND AIRFIELDS PUBLISHED IN AIP VFR" -> AD 1-en-GB.html)
        that maps ICAO codes to names. Best-effort: on any failure the
        ICAO-only titles are kept.
        """
        soup = self.soup(nav_html)
        ad1_url = None
        for a in soup.find_all("a", href=True):
            if re.search(r"AD 1-en-GB\.html", a["href"]):
                ad1_url = urljoin(nav_url, a["href"].split("#")[0])
                break
        if ad1_url is None:
            self.logger.warning("PL: no AD 1 index link; keeping ICAO titles")
            return

        index_html = self.fetch(ad1_url)
        names: dict[str, str] = {}
        for tr in self.soup(index_html).find_all("tr"):
            cells = [
                c.get_text(" ", strip=True)
                for c in tr.find_all(["td", "th"])
            ]
            icaos = [c for c in cells if re.fullmatch(r"EP[A-Z]{2}", c)]
            if len(icaos) != 1:
                continue
            icao = icaos[0]
            for cell in cells:
                if cell == icao:
                    continue
                # First cell that looks like a name (has letters, is not a
                # page/date reference, keeps a sane length).
                cleaned = " ".join(
                    t for t in cell.split() if ";" not in t
                ).strip()
                if (
                    re.search(r"[A-Za-zÀ-žŁłŚśŻżŹźĆćŃńÓó]{3}", cleaned)
                    and not re.fullmatch(r"[\d\s./-]+", cleaned)
                    and len(cleaned) <= 60
                ):
                    names.setdefault(icao, cleaned)
                    break

        if not names:
            self.logger.warning(
                f"PL: no ICAO/name rows parsed from {ad1_url}; "
                "keeping ICAO titles"
            )
            return

        enriched = 0
        for airport in airports:
            name = names.get(airport.icao or "")
            if name:
                airport.title = f"{name} {airport.icao}"
                enriched += 1
        self.logger.info(
            f"PL: enriched {enriched}/{len(airports)} titles from AD 1 index"
        )

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

            # 2. Prefetch the entry page (following redirects) so failure
            #    diagnostics show THIS page, not the hub (round-7 gap), then
            #    hunt for the actual frameset from it.
            entry_resp = self.fetch_response(entry_url)
            entry_url, entry_html = str(entry_resp.url), entry_resp.text
            last_url, last_html = entry_url, entry_html

            frameset_url, frameset_html = self._find_frameset(
                entry_url, entry_html
            )
            last_url, last_html = frameset_url, frameset_html

            # 3. Walk the frame chain to the navigation HTML. Some builds skip
            #    the eAISNavigationBase wrapper (the index IS the top frameset,
            #    as on the BE eAIP) - fall back to the single hop.
            try:
                nav_url, nav_html = self.follow_frame_chain(
                    frameset_url, ["eAISNavigationBase", "eAISNavigation"]
                )
            except Exception:
                nav_url, nav_html = self.follow_frame_chain(
                    frameset_url, ["eAISNavigation"]
                )
            last_url, last_html = nav_url, nav_html

            # 4. One "AD 4 <ICAO>" chapter per airfield (round-8 diagnostics;
            #    the PL AIP VFR has no aggregate AD 2/AD 3 sections). Fall
            #    back to the generic AD 2/AD 3 layout just in case a future
            #    edition switches to the standard structure.
            try:
                airports.extend(
                    self._extract_airport_sections(nav_html, nav_url)
                )
                # Best-effort: replace the ICAO-only titles with real
                # airfield names from the AD 1 index page.
                try:
                    self._enrich_titles(airports, nav_html, nav_url)
                except Exception as e:
                    self.logger.warning(
                        f"PL: title enrichment failed ({e}); keeping ICAO titles"
                    )
            except ValueError as e:
                self.logger.warning(f"PL: AD 4 extraction failed ({e}); "
                                    "trying the generic AD 2/AD 3 layout")
                airports.extend(
                    self.extract_airports_from_html(
                        nav_html, nav_url, "AD 2en-GBdetails", "vfr"
                    )
                )
                try:
                    airports.extend(
                        self.extract_airports_from_html(
                            nav_html, nav_url, "AD 3en-GBdetails", "heliport"
                        )
                    )
                except ValueError as e2:
                    self.logger.warning(f"PL: skipping heliports - {e2}")
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
