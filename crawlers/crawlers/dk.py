"""Denmark AIP crawler.

Source: Naviair AIM (https://aim.naviair.dk/). The site is a client-rendered
Angular treegrid whose rendered DOM carries no anchors - but the tree data
comes from an OPEN Umbraco JSON API, identified via the Playwright network
capture (run 29289869395):

    GET https://aim.naviair.dk/umbraco/api/naviairapi/getnodesforparent?parentId=<id>

Empty ``parentId`` returns the root nodes (e.g. ``{"id": 295, "name": "AIP
Danmark", ...}``, ``{"id": 1, "name": "VFR Flight Guide Danmark", ...}``);
each node carries ``id``, ``name``/``title``, ``isDir``/``hasChildren`` and -
on leaf documents - an ``href``/``link``. The crawl therefore walks the JSON
tree directly with plain httpx (no browser in the happy path):

    root └─ "VFR Flight Guide Danmark"
             └─ "VFG Part 3 - FLYVEPLADSER (AD)"
                 ├─ "AD 2 - PUBLIC AERODROMES"  → type "vfr"
                 └─ "AD 3 - HELIPORTS"          → type "heliport"

For each airfield node below AD 2/AD 3:
  - title: the listed label with the ICAO moved to the end and the " - "
    separator dropped, e.g. "Anholt - EKAT" → "Anholt EKAT".
  - icao:  the trailing 4-letter code (e.g. "EKAT"); may be None.
  - url:   the ADC (Aerodrome Chart) document, e.g.
    ``EK_AD_2_EKEB_ADC_en.pdf`` - with every other chart document of the
    airfield collected into ``charts`` (Stage-2 chart list) and the ADC as
    ``pdf_url``.

The exact node layout below AD 2 is still best-effort (folders per airfield
vs. direct documents) - the walker handles both, recurses at most two levels
deep, and logs the node names it saw whenever a navigation step comes up
empty, so the next live run pinpoints any mismatch. The Playwright base stays
as the diagnostic fallback: if the JSON walk fails, the root is rendered with
network capture to reveal what changed.
"""

from __future__ import annotations

import re
from urllib.parse import urljoin

from crawlers.dk_hours import parse_dk_hours
from crawlers.http_base import Airport, current_airac_date
from crawlers.models import ChartLink
from crawlers.playwright_base import PlaywrightCrawlerBase, PlaywrightUnavailable

COUNTRY = "DK"
ROOT_URL = "https://aim.naviair.dk/"
API_URL = "https://aim.naviair.dk/umbraco/api/naviairapi/getnodesforparent"

# Trailing 4-letter ICAO in a label ("Anholt - EKAT" → "EKAT"). Danish codes
# start with "EK" but we keep the match generic to 4 uppercase letters.
_ICAO_TRAILING = re.compile(r"([A-Z]{4})\s*$")
# ICAO embedded in an ADC filename (…_EKEB_ADC_en.pdf → "EKEB").
_ICAO_IN_HREF = re.compile(r"([A-Z]{4})[_-]?ADC", re.I)
# The aerodrome-DATA sheet: EK_AD_2_<ICAO>_<lang>.pdf, i.e. the ICAO directly
# followed by the 2-letter language, with NO chart-type section (ADC/VAC/...);
# it carries the AD 2.3 operating-hours table. Built per field from its ICAO.
# Cap mirrors attach_pdf_urls (see http_base): keep payloads bounded.
_MAX_CHARTS = 50


class DK(PlaywrightCrawlerBase):
    """Denmark crawler over the Naviair Umbraco JSON tree API.

    The happy path is browserless: it walks `getnodesforparent` (see the
    module docstring) with plain httpx down to the AD 2 / AD 3 airfield nodes.
    Inheriting ``PlaywrightCrawlerBase`` only for the diagnostic render
    fallback (`_render_diagnostics`) when the JSON walk finds nothing.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    # ----- JSON tree walking ----------------------------------------------

    def _nodes(self, parent_id: int | str = "") -> list[dict]:
        """Children of ``parent_id`` from the Umbraco tree API ([] on any
        mismatch - the caller logs context)."""
        response = self.fetch_response(f"{API_URL}?parentId={parent_id}")
        data = response.json()
        return data if isinstance(data, list) else []

    @staticmethod
    def _label(node: dict) -> str:
        """Human-readable node label (``name`` preferred, ``title`` kept as
        fallback - the title carries chapter numbering like "01. ...")."""
        return str(node.get("name") or node.get("title") or "").strip()

    def _child_by_text(self, nodes: list[dict], *needles: str) -> dict | None:
        """Node whose name/title matches the needles (case-insensitive).

        A node containing ALL needles wins over one containing ANY - with
        any-first, ("AD 3", "HELIPORTS") grabbed "AD 1 -
        AERODROMES_HELIPORTS - INTRODUCTION" before the real AD 3 chapter
        (run 29291001169). Logs the available labels when nothing matches.
        """
        wanted = [n.lower() for n in needles]
        texts = [
            f"{node.get('name', '')} {node.get('title', '')}".lower()
            for node in nodes
        ]
        for node, text in zip(nodes, texts):
            if all(n in text for n in wanted):
                return node
        for node, text in zip(nodes, texts):
            if any(n in text for n in wanted):
                return node
        self.logger.warning(
            f"DK: no tree node matching {needles!r}; "
            f"available: {[self._label(n) for n in nodes][:20]}"
        )
        return None

    @staticmethod
    def _doc_href(node: dict) -> str | None:
        """A leaf document's target, wherever the API carries it."""
        for key in ("href", "link"):
            value = node.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    def _collect_documents(self, node: dict, depth: int = 0) -> list[dict]:
        """All leaf documents under ``node`` (the node itself if it already
        is one), recursing at most two folder levels."""
        href = self._doc_href(node)
        if href is not None:
            return [node]
        if depth >= 2 or not (node.get("isDir") or node.get("hasChildren")):
            return []
        docs: list[dict] = []
        for child in self._nodes(node.get("id", "")):
            docs.extend(self._collect_documents(child, depth + 1))
        return docs

    # ----- extraction ------------------------------------------------------

    def _title_and_icao(self, label: str) -> tuple[str, str | None]:
        """Normalise a listed label into (title, icao).

        "Anholt - EKAT" → ("Anholt EKAT", "EKAT"). The " - " separator is
        dropped and the ICAO kept at the end. ICAO may be None.
        """
        label = self.clean_text(label)
        normalised = re.sub(r"\s*-\s*", " ", label).strip()
        match = _ICAO_TRAILING.search(normalised)
        icao = match.group(1) if match else None
        return normalised, icao

    def _airport_from_node(self, node: dict, category: str) -> Airport | None:
        """One airfield node (folder or document) → one Airport, anchored on
        its ADC chart; every PDF document becomes a charts entry."""
        title, icao = self._title_and_icao(self._label(node))
        docs = self._collect_documents(node)
        if not docs:
            self.logger.debug(f"DK: no documents under {self._label(node)!r}")
            return None

        # Collect every PDF document as a chart; remember the first ADC
        # (Aerodrome Chart) seen - matched on the filename or its label.
        charts: list[ChartLink] = []
        adc_url: str | None = None
        for doc in docs:
            href = self._doc_href(doc)
            if href is None:
                continue
            url = urljoin(ROOT_URL, href)
            name = self._label(doc) or url.rsplit("/", 1)[-1]  # filename fallback
            if len(charts) < _MAX_CHARTS:
                charts.append(ChartLink(name=name, url=url))
            if adc_url is None and (
                "ADC" in href.upper() or "ADC" in name.upper()
            ):
                adc_url = url

        if not charts:
            return None
        # The ADC is the agreed main link (task spec); fall back to the first
        # document so an airfield without a dedicated ADC still lists.
        main_url = adc_url or charts[0].url

        # Last-resort ICAO: pull it from the chosen chart's filename when the
        # label had no trailing code.
        if icao is None:
            href_match = _ICAO_IN_HREF.search(main_url)
            if href_match:
                icao = href_match.group(1).upper()
                title = title or icao
        if not title:
            return None

        # Operating hours: the Naviair "..._<ICAO>_en.pdf" DATA sheet (the
        # "01. AD 2 <ICAO> text" document, no chart-type suffix) carries them,
        # but NOT under the ICAO "AD 2.3" heading the shared parser keys on - it
        # is a flat "4. Operational hours" layout, so DK uses its own
        # pre-processor (`dk_hours.parse_dk_hours`) over the data sheet's text.
        # Fail-soft - a field without a readable data sheet shows no hours.
        # `pdf_text` uses the httpx client, so it works from the Playwright base.
        if icao:
            data_sheet = next(
                (
                    c.url
                    for c in charts
                    if re.search(
                        rf"AD_2_{re.escape(icao)}_[a-z]{{2}}\.pdf$", c.url, re.I
                    )
                ),
                None,
            )
            if data_sheet:
                try:
                    hrs = parse_dk_hours(self.pdf_text(data_sheet))
                except Exception as e:  # a bad PDF must never abort the crawl
                    hrs = None
                    self.logger.debug(f"DK: {icao} AD 2.3 hours failed: {e}")
                if hrs:
                    self.hours_by_icao[icao] = hrs
                    # Clean text layer in practice (source "eaip"); only stamp
                    # the OCR disclaimer if a field ever needs the image fallback.
                    if self._last_pdf_ocr:
                        self.hours_source_by_icao[icao] = "pdf-ocr-hours"

        return Airport(
            country=COUNTRY,
            icao=icao,
            title=title,
            url=main_url,
            # Only set pdf_url when the main link really is a PDF (it usually is).
            pdf_url=main_url if main_url.lower().endswith(".pdf") else None,
            charts=charts or None,
            type=category,
        )

    def _extract_section(self, section: dict, category: str) -> list[Airport]:
        """Turn every airfield node under one AD 2/AD 3 section into Airports.

        Skips chapter documents (intro/index PDFs) that sit directly under the
        section, since those have no "Name - ICAO" label and are not fields.
        """
        airports: list[Airport] = []
        for node in self._nodes(section.get("id", "")):
            # Chapter documents sitting DIRECTLY under the section (the AD 3.1
            # intro/index PDF, label = its filename) are not airfields: real
            # entries are "Name - ICAO" labelled. A direct document without a
            # trailing ICAO in its label is skipped (run 29291960740 shipped
            # 'EK_AD_3_1_en.pdf' as a heliport without this guard).
            label = re.sub(r"\s*-\s*", " ", self._label(node)).strip()
            if (
                self._doc_href(node) is not None
                and _ICAO_TRAILING.search(label) is None
            ):
                self.logger.debug(
                    f"DK: skipping chapter document {self._label(node)!r}"
                )
                continue
            airport = self._airport_from_node(node, category)
            if airport is not None:
                airports.append(airport)
        self.logger.info(
            f"DK: extracted {len(airports)} '{category}' airports from "
            f"{self._label(section)!r}"
        )
        return airports

    # ----- dual-source (AIP Danmark + VFR Flight Guide) --------------------

    def _part3_children(
        self,
        root: list[dict],
        product: tuple[str, ...],
        part3: tuple[str, ...],
    ) -> list[dict]:
        """Descend root -> <product> -> <Part 3 - FLYVEPLADSER (AD)> and return
        the AD-section nodes under Part 3, or [] (fail-soft) if either step is
        missing. Used for both the VFR Flight Guide and the AIP Danmark trees,
        which share this shape but label the nodes differently."""
        prod = self._child_by_text(root, *product)
        if prod is None:
            return []
        part3_node = self._child_by_text(self._nodes(prod["id"]), *part3)
        if part3_node is None:
            return []
        return self._nodes(part3_node["id"])

    def _section_airports(
        self,
        part3_children: list[dict],
        needles: tuple[str, ...],
        category: str,
    ) -> list[Airport]:
        """Airports of one AD section (picked from Part 3's children by
        ``needles``), or [] when the section is absent (fail-soft)."""
        if not part3_children:
            return []
        section = self._child_by_text(part3_children, *needles)
        if section is None:
            return []
        return self._extract_section(section, category)

    @staticmethod
    def _chart_basename(url: str) -> str:
        """A chart URL's PDF filename (no path/hash), lower-cased. The AIP and
        the VFR Flight Guide publish the SAME chart as separate media files
        (different ``/media/files/<hash>/`` paths, identical filename), so
        deduping by basename collapses those while keeping each product's
        UNIQUE charts (the AIP's extra IFR sheets)."""
        return url.rsplit("/", 1)[-1].lower()

    def _merge_by_icao(self, *groups: list[Airport]) -> list[Airport]:
        """Merge airport lists (in priority order - the first group a field
        appears in wins its identity/primary link) by ICAO, or by title for
        ICAO-less fields. Charts are UNIONED across the sources, deduped by
        filename and capped, so a field published in both products keeps every
        distinct chart; fields in only one source pass through. Per-field hours
        are already in ``hours_by_icao`` (filled during each extraction)."""
        by_key: dict[str, Airport] = {}
        order: list[str] = []
        for group in groups:
            for a in group:
                key = (a.icao or a.title or "").strip().upper()
                if not key:
                    continue
                base = by_key.get(key)
                if base is None:
                    by_key[key] = a
                    order.append(key)
                    continue
                seen = {self._chart_basename(c.url) for c in (base.charts or [])}
                combined = list(base.charts or [])
                for c in a.charts or []:
                    bn = self._chart_basename(c.url)
                    if bn not in seen and len(combined) < _MAX_CHARTS:
                        seen.add(bn)
                        combined.append(c)
                base.charts = combined or None
        return [by_key[k] for k in order]

    # ----- entry point -----------------------------------------------------

    def crawl(self) -> list[Airport]:
        """Walk the Naviair JSON tree into Airports, from BOTH products - the
        VFR Flight Guide (AD 2 public + AD 3 heliports + AD 4 private) and AIP
        Danmark (AD 2 aerodromes) - merging the AD-2 aerodromes by ICAO so a
        field in both keeps every distinct chart (the AIP's IFR sheets on top of
        the VFG's VFR set) and AIP-only fields are added.

        Fully fail-soft: a missing node returns whatever was gathered so far (a
        lost step is a data gap, not a crash), and an empty VFG triggers the
        Playwright render diagnostics so the next run sees what the API renamed.
        """
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []

        try:
            # WAF-friendly headers; the JSON API is open but picky about UA.
            self.use_browser_headers()
            root = self._nodes("")
            # Naviair publishes DK aerodromes in TWO products, both important:
            # "02. VFR Flight Guide Danmark" (VFR-focused, the historic source)
            # and "01. AIP Danmark" (the full/IFR AIP - it carries the IFR charts
            # the VFG omits and any IFR-only fields). Walk BOTH, merge by ICAO.
            vfg_part3 = self._part3_children(
                root, ("VFR Flight Guide",), ("Part 3", "FLYVEPLADSER")
            )
            if not vfg_part3:
                # VFG lookup failed - render the SPA to reveal the new layout.
                self._render_diagnostics()
                return airports
            # Naviair JSON API carries no edition date; stamp on-cycle AIRAC.
            self.airac = current_airac_date()

            vfg_ad2 = self._section_airports(
                vfg_part3, ("AD 2", "PUBLIC AERODROMES"), "vfr"
            )
            heliports = self._section_airports(
                vfg_part3, ("AD 3", "HELIPORTS"), "heliport"
            )
            # Few AD-3 entries and a history of grabbing the wrong chapter (the
            # AD 1 intro) - log them all so the live run verifies the pick.
            for airport in heliports:
                self.logger.info(
                    f"DK heliport: {airport.icao} | {airport.title} "
                    f"-> {airport.url}"
                )
            # AD 4 PRIVATE: historically 0 per-field entries (Denmark publishes
            # its private/glider fields only as a combined list PDF, not per
            # field), but attempt it anyway - fail-soft, and the live-test shows
            # if the source ever starts publishing them individually.
            vfg_ad4 = self._section_airports(vfg_part3, ("AD 4", "PRIVATE"), "vfr")

            # "01. AIP Danmark" AD 2 aerodromes (the full/IFR AIP).
            aip_part3 = self._part3_children(
                root, ("AIP Danmark",), ("PART 3", "FLYVEPLADSER")
            )
            aip_ad2 = self._section_airports(
                aip_part3, ("AD 2", "AERODROMES"), "vfr"
            )

            # Merge the AD-2 aerodromes (+ AD 4 private) from both products by
            # ICAO, unioning charts (deduped by filename) so a field in both
            # keeps every distinct chart - the AIP's IFR charts on top of the
            # VFG's VFR set - and AIP-only fields are added.
            merged = self._merge_by_icao(vfg_ad2, aip_ad2, vfg_ad4)
            self.logger.info(
                f"DK: merged AD-2 aerodromes: VFG {len(vfg_ad2)} + AIP "
                f"{len(aip_ad2)} + AD4 {len(vfg_ad4)} -> {len(merged)} unique"
            )
            airports.extend(merged)
            airports.extend(heliports)
        except Exception as e:
            self.logger.error(f"DK crawl failed: {e}")
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports

    def _render_diagnostics(self) -> None:
        """Fallback reconnaissance when the JSON walk finds nothing: render
        the SPA with network capture so the live-test log shows what the
        source now calls (endpoint moved/renamed)."""
        try:
            self.render_html(ROOT_URL, wait_ms=5000, capture_network=True)
            self.log_network_capture()
        except PlaywrightUnavailable as e:
            self.logger.warning(f"DK: render diagnostics unavailable: {e}")
        except Exception as e:
            self.logger.warning(f"DK: render diagnostics failed: {e}")
