"""POST crawled airports to the AIP:Aero API.

Two safeguards on top of the raw POST:

1. **Last-run count check.** We persist a small JSON file with the last
   successful airport count per country. If the new count drops by more
   than 50%, refuse to publish — it's almost always a parser bug. Override
   with the `CRAWLER_FORCE_PUBLISH=1` env var when the drop is genuine.
2. **httpx with explicit timeout.** Replaces the legacy `requests` call.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

import httpx

from crawlers.models import Airport
from settings import Settings

DEFAULT_DROP_THRESHOLD = 0.5  # refuse if new count < 50% of last
COUNT_STATE_FILE = Path("last_run_counts.json")
HTTP_TIMEOUT = httpx.Timeout(60.0, connect=10.0)


class CountDropAbort(RuntimeError):
    """Raised when a count drop exceeds the configured threshold and the
    user hasn't set CRAWLER_FORCE_PUBLISH=1."""


class OutputHandler:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.logger = logging.getLogger(__name__)
        self._last_counts: dict[str, int] = self._load_counts()

    def _load_counts(self) -> dict[str, int]:
        if not COUNT_STATE_FILE.exists():
            return {}
        try:
            return json.loads(COUNT_STATE_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as e:
            self.logger.warning(
                f"Could not read {COUNT_STATE_FILE} ({e}); treating as first run."
            )
            return {}

    def _save_counts(self) -> None:
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
            self.logger.info(
                f"{country}: no prior count on record; recording {new_count}."
            )
            return
        if new_count >= last_count * (1 - DEFAULT_DROP_THRESHOLD):
            return  # within tolerance
        msg = (
            f"{country}: count dropped from {last_count} to {new_count} "
            f"(> {int(DEFAULT_DROP_THRESHOLD * 100)}% drop). "
            f"This is usually a parser bug."
        )
        if os.environ.get("CRAWLER_FORCE_PUBLISH"):
            self.logger.warning(f"{msg} CRAWLER_FORCE_PUBLISH set, publishing anyway.")
            return
        raise CountDropAbort(msg + " Set CRAWLER_FORCE_PUBLISH=1 to override.")

    def write_output(self, airports: list[Airport], country: str) -> None:
        if not airports:
            self.logger.warning(f"No airports found for {country}. Skipping output.")
            return

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

        self.logger.info(
            f"Writing {len(airports)} airports for {country} "
            f"to {self.settings.api_endpoint}"
        )
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

        try:
            with httpx.Client(timeout=HTTP_TIMEOUT) as client:
                response = client.post(
                    self.settings.api_endpoint,
                    json=payload,
                    headers={"Authorization": f"Bearer {self.settings.api_key}"},
                )
                response.raise_for_status()
        except httpx.HTTPError as e:
            self.logger.error(f"Failed to write output for {country}: {e}")
            return

        # Only update the recorded counts after a successful publish. The
        # "<CC>::pdf" key rides in the same state file (actions/cache) and is
        # ignored by the airport-count drop guard.
        self._last_counts[country.upper()] = len(airports)
        self._last_counts[f"{country.upper()}::pdf"] = pdf_count
        self._save_counts()
        self.logger.info(f"Successfully wrote output for {country}.")
