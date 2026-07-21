"""POST crawled airports to the AIP:Aero API.

This is the bridge from the Python crawlers to the website: it serializes each
country's airports into the JSON shape the `/api/airports` ingest endpoint
expects (validated there by drizzle-zod) and POSTs it with the shared
`CRON_SECRET` bearer token. The endpoint then atomically replaces that
country's rows in D1.

Two safeguards on top of the raw POST:

1. **Last-run count check.** We persist a small JSON file with the last
   successful airport count per country. If the new count drops by more
   than 50%, refuse to publish - it's almost always a parser bug (markup
   drift silently yielding fewer airports). Override with the
   `CRAWLER_FORCE_PUBLISH=1` env var when the drop is genuine.
2. **httpx with explicit timeout.** Replaces the legacy `requests` call.

The count-state JSON is persisted across GitHub Actions runs via
`actions/cache`, so the drop guard has a baseline to compare against.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

import httpx

from crawlers.http_eurocontrol_base import title_name_looks_bad
from crawlers.models import Airport
from crawlers.operating_hours import StructuredHours, to_json
from settings import Settings

DEFAULT_DROP_THRESHOLD = 0.5  # refuse if new count < 50% of last
# Warn (Actions annotation) when more than this share of a country's titles
# have no real place name - a bare ICAO or a chart-designator/boilerplate
# "name" (the NL/ES/FI-heliport class of bug). A launch that ships a listing
# of chart codes instead of aerodrome names must not pass silently.
TITLE_QUALITY_WARN_RATIO = 0.2
# Per-country last-successful counts, persisted between Actions runs (actions/cache).
COUNT_STATE_FILE = Path("last_run_counts.json")
# Generous total budget, short connect timeout - some AIP hosts are slow.
HTTP_TIMEOUT = httpx.Timeout(60.0, connect=10.0)


class CountDropAbort(RuntimeError):
    """Raised when a count drop exceeds the configured threshold and the
    user hasn't set CRAWLER_FORCE_PUBLISH=1."""


class OutputHandler:
    """Publishes one country's airports to the API, guarded by the drop check."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.logger = logging.getLogger(__name__)
        # Load the baseline counts from the previous successful run (if any).
        self._last_counts: dict[str, int] = self._load_counts()

    def _load_counts(self) -> dict[str, int]:
        """Read the persisted per-country counts; empty dict on first run/read error."""
        if not COUNT_STATE_FILE.exists():
            return {}
        try:
            return json.loads(COUNT_STATE_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as e:
            # Corrupt/unreadable state must not block a crawl: treat as first run.
            self.logger.warning(
                f"Could not read {COUNT_STATE_FILE} ({e}); treating as first run."
            )
            return {}

    def _save_counts(self) -> None:
        """Persist the updated counts so the next run has a fresh baseline."""
        try:
            COUNT_STATE_FILE.write_text(
                json.dumps(self._last_counts, sort_keys=True, indent=2),
                encoding="utf-8",
            )
        except OSError as e:
            self.logger.warning(f"Could not persist {COUNT_STATE_FILE}: {e}")

    def _check_count_sanity(self, country: str, new_count: int) -> None:
        """Refuse to publish if the count dropped more than DEFAULT_DROP_THRESHOLD
        from the last successful run, unless CRAWLER_FORCE_PUBLISH is set."""
        last_count = self._last_counts.get(country.upper())
        if last_count is None:
            # First time we see this country: nothing to compare against.
            self.logger.info(
                f"{country}: no prior count on record; recording {new_count}."
            )
            return
        # Publish freely as long as we kept at least (1 - threshold) of last run.
        if new_count >= last_count * (1 - DEFAULT_DROP_THRESHOLD):
            return  # within tolerance
        msg = (
            f"{country}: count dropped from {last_count} to {new_count} "
            f"(> {int(DEFAULT_DROP_THRESHOLD * 100)}% drop). "
            f"This is usually a parser bug."
        )
        # Escape hatch for a genuine, expected drop (e.g. a source pruned fields).
        if os.environ.get("CRAWLER_FORCE_PUBLISH"):
            self.logger.warning(f"{msg} CRAWLER_FORCE_PUBLISH set, publishing anyway.")
            return
        raise CountDropAbort(msg + " Set CRAWLER_FORCE_PUBLISH=1 to override.")

    @staticmethod
    def _title_name_part(airport: Airport) -> str:
        """The place-name portion of an airport title (the "<name>" in the
        canonical "<name> <ICAO>" form). Falls back to the whole title when the
        field has no ICAO (name-only listings are legitimate)."""
        title = (airport.title or "").strip()
        icao = (airport.icao or "").strip()
        if icao and title.upper().endswith(icao.upper()):
            return title[: len(title) - len(icao)].strip()
        return title

    def _check_title_quality(self, airports: list[Airport], country: str) -> None:
        """Warn (loudly, as a GitHub Actions annotation) when too many of a
        country's titles carry no real aerodrome name - a bare ICAO or a chart
        designator / AD-section boilerplate instead of a place name. This is the
        NL/ES/FI-heliport class of bug; catching it here means a newly onboarded
        country cannot ship a listing of chart codes without a visible warning
        in the run log. Never blocks the publish (fail-soft)."""
        bad = [a for a in airports if title_name_looks_bad(self._title_name_part(a))]
        if not bad:
            return
        ratio = len(bad) / len(airports)
        sample = ", ".join(f"{a.title!r}" for a in bad[:5])
        msg = (
            f"{country}: {len(bad)}/{len(airports)} titles have no place name "
            f"(e.g. {sample}) - the name source is likely wrong "
            f"(docs: title_name_looks_bad in http_eurocontrol_base.py)"
        )
        self.logger.warning(msg)
        if ratio >= TITLE_QUALITY_WARN_RATIO:
            print(f"::warning title=Title quality::{msg}", flush=True)

    def write_output(
        self, airports: list[Airport], country: str, airac: str | None = None
    ) -> None:
        """Validate, serialize and POST one country's airports to the API.

        Bails (without error) on an empty result or a tripped drop guard;
        only records the new baseline counts after the POST actually succeeds.

        ``airac`` (ISO edition date) is forwarded to the API as an ``?airac=``
        query param when a crawler provides it (DE, whose stored URLs carry no
        date); the API stamps it into ``crawl_meta.airac``. Omitted otherwise -
        the website derives the edition from the airport URLs for those sources.
        """
        # An empty result never overwrites live data (would look like a total loss).
        if not airports:
            self.logger.warning(f"No airports found for {country}. Skipping output.")
            return

        # Drop guard: abort the publish if the count collapsed vs. the last run.
        try:
            self._check_count_sanity(country, len(airports))
        except CountDropAbort as e:
            self.logger.error(str(e))
            return

        # Chart-PDF coverage monitoring: the extracted pdf_urls are edition-
        # specific and the chart-page markup shifts with AIRAC cycles - a
        # collapse to 0 where the last run had coverage means the per-country
        # selectors broke. Publish anyway (fail-soft: the site falls back to
        # the chart-page url), but flag it loudly in the run log.
        pdf_count = sum(1 for a in airports if a.pdf_url)
        last_pdf = self._last_counts.get(f"{country.upper()}::pdf")
        self.logger.info(
            f"{country}: pdf_url coverage {pdf_count}/{len(airports)}"
            + (f" (last run: {last_pdf})" if last_pdf is not None else "")
        )
        if last_pdf and pdf_count == 0:
            msg = (
                f"{country}: chart-PDF coverage collapsed ({last_pdf} -> 0) - "
                "chart-page markup likely changed (docs/chart-pdf-plan.md); "
                "the site falls back to the chart-page url meanwhile"
            )
            self.logger.warning(msg)
            # GitHub Actions annotation (the daily crawl runs there).
            print(f"::warning title=Chart-PDF coverage::{msg}", flush=True)

        # Title-quality guard: flag a country that ships bare ICAOs / chart
        # designators instead of aerodrome names (fail-soft, never blocks).
        self._check_title_quality(airports, country)

        self.logger.info(
            f"Writing {len(airports)} airports for {country} "
            f"to {self.settings.api_endpoint}"
        )
        # Map each Airport model to the JSON object the API's Zod schema expects.
        payload = [
            {
                "icao": a.icao if a.icao else None,
                "title": a.title,
                "url": a.url,
                # Key matches the Drizzle column property (`pdfUrl`), which the
                # API's drizzle-zod schema validates against.
                "pdfUrl": a.pdf_url,
                # JSON-encoded chart list ({name, url} each) - the `charts`
                # column is TEXT, so the string IS the stored value.
                "charts": (
                    json.dumps(
                        [c.model_dump() for c in a.charts], ensure_ascii=False
                    )
                    if a.charts
                    else None
                ),
                "type": a.airport_type,
                "country": country.upper(),
            }
            for a in airports
        ]

        # POST the batch with the CRON_SECRET bearer token; 4xx/5xx raises.
        # Forward the edition date (when the crawler knows it) as ?airac=.
        endpoint = self.settings.api_endpoint
        if airac:
            sep = "&" if "?" in endpoint else "?"
            endpoint = f"{endpoint}{sep}airac={airac}"
            self.logger.info(f"{country}: forwarding AIRAC {airac} to the API")
        try:
            with httpx.Client(timeout=HTTP_TIMEOUT) as client:
                response = client.post(
                    endpoint,
                    json=payload,
                    headers={"Authorization": f"Bearer {self.settings.api_key}"},
                )
                response.raise_for_status()
        except httpx.HTTPError as e:
            # Publish failed: leave the baseline counts untouched so the drop
            # guard still compares against the last GOOD run next time.
            self.logger.error(f"Failed to write output for {country}: {e}")
            return

        # Only update the recorded counts after a successful publish. The
        # "<CC>::pdf" key rides in the same state file (actions/cache) and is
        # ignored by the airport-count drop guard.
        self._last_counts[country.upper()] = len(airports)
        self._last_counts[f"{country.upper()}::pdf"] = pdf_count
        self._save_counts()
        self.logger.info(f"Successfully wrote output for {country}.")

    def _facts_endpoint(self) -> str:
        """The /api/airport-facts URL, derived from the airports ingest endpoint
        (they share a host). Strips any query string from api_endpoint first."""
        base = self.settings.api_endpoint.split("?", 1)[0]
        return base.rsplit("/api/", 1)[0] + "/api/airport-facts"

    def publish_hours(
        self,
        hours_by_icao: dict[str, StructuredHours | None],
        country: str,
        declared_by_icao: dict[str, object] | None = None,
        hours_source: str = "eaip",
        source_by_icao: dict[str, str] | None = None,
    ) -> None:
        """Publish AUTHORITATIVE eAIP AD 2.3 operation hours AND AD 2.13 declared
        distances via PATCH /api/airport-facts. Hours carry ``hours_source``
        (default "eaip"; DE passes "dfs-ocr-hours" for its OCR-derived hours,
        which the API enum + precedence rank recognise). ``source_by_icao`` is an
        optional PER-FIELD override of that source - used to tag the specific
        fields whose AD 2.3 hours came from the image-only-PDF OCR fallback as
        "pdf-ocr-hours" while their clean-text siblings stay "eaip". The two are
        merged per ICAO into one row set (each row carries whichever data the
        crawler collected). Never touches the base facts columns (coords/runways).
        Fully fail-soft - a publish failure must never fail the airport crawl.
        Only ICAO-bearing fields with data are sent."""
        declared_by_icao = declared_by_icao or {}
        source_by_icao = source_by_icao or {}
        # Merge hours + declared distances per ICAO into one PATCH row each.
        rows_by_icao: dict[str, dict[str, object]] = {}
        for icao, hours in hours_by_icao.items():
            if icao and hours is not None:
                row = rows_by_icao.setdefault(icao.upper(), {"icao": icao.upper()})
                row["hoursStructured"] = to_json(hours)
                row["hoursSource"] = source_by_icao.get(icao, hours_source)
        for icao, declared in declared_by_icao.items():
            if icao and declared:
                row = rows_by_icao.setdefault(icao.upper(), {"icao": icao.upper()})
                row["declaredDistances"] = json.dumps(declared)
                row["declaredSource"] = "eaip"
        rows = list(rows_by_icao.values())
        if not rows:
            self.logger.info(f"{country}: no AD 2.3/2.13 data to publish.")
            return
        url = self._facts_endpoint()
        self.logger.info(
            f"{country}: publishing AD 2.3/2.13 data for {len(rows)} fields"
        )
        try:
            with httpx.Client(timeout=HTTP_TIMEOUT) as client:
                response = client.patch(
                    url,
                    json=rows,
                    headers={"Authorization": f"Bearer {self.settings.api_key}"},
                )
                response.raise_for_status()
        except httpx.HTTPError as e:
            self.logger.warning(
                f"{country}: failed to publish AD 2.3/2.13 data: {e}"
            )

    def publish_ad2_text(
        self,
        text_by_icao: dict[str, str],
        country: str,
        text_de_by_icao: dict[str, str] | None = None,
    ) -> None:
        """Publish DE's raw OCR'd AD-2 page text (source "dfs-ocr") via PATCH
        /api/airport-facts, split by page language: ``text_by_icao`` = the
        English pages (ad2OcrText), ``text_de_by_icao`` = the German pages
        (ad2OcrTextDe). DISPLAY-only: the website renders the locale-appropriate
        blob under a "read by text recognition, verify against the AIP" caveat.
        Touches only the ad2_ocr_text* columns. Fully fail-soft - only ICAO
        fields with text are sent, and a publish failure never fails the crawl."""
        text_de_by_icao = text_de_by_icao or {}
        rows_by_icao: dict[str, dict[str, object]] = {}
        for icao, text in text_by_icao.items():
            if icao and text:
                row = rows_by_icao.setdefault(
                    icao.upper(), {"icao": icao.upper(), "ad2OcrSource": "dfs-ocr"}
                )
                row["ad2OcrText"] = text
        for icao, text in text_de_by_icao.items():
            if icao and text:
                row = rows_by_icao.setdefault(
                    icao.upper(), {"icao": icao.upper(), "ad2OcrSource": "dfs-ocr"}
                )
                row["ad2OcrTextDe"] = text
        rows = list(rows_by_icao.values())
        if not rows:
            self.logger.info(f"{country}: no AD-2 OCR text to publish.")
            return
        url = self._facts_endpoint()
        self.logger.info(f"{country}: publishing AD-2 OCR text for {len(rows)} fields")
        try:
            with httpx.Client(timeout=HTTP_TIMEOUT) as client:
                response = client.patch(
                    url,
                    json=rows,
                    headers={"Authorization": f"Bearer {self.settings.api_key}"},
                )
                response.raise_for_status()
        except httpx.HTTPError as e:
            self.logger.warning(f"{country}: failed to publish AD-2 OCR text: {e}")
