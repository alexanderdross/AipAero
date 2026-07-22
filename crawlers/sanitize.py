"""Central per-country sanitize + dedup pass over crawled airports.

Runs once on the final list a crawler returns, right before it is published
(called at the top of ``OutputHandler.write_output``). It is the single choke
point where cross-section data-quality invariants are enforced WITHOUT killing
a country:

- **De-duplicate by ICAO** (first row wins). The generic eurocontrol extractors
  do not dedupe across sections, so a field listed in both AD 2 and AD 4 (or
  VFR and IFR) would otherwise ship twice; the API delete+reinsert has no unique
  constraint to catch it.
- **Flag** (never drop) malformed ICAOs and titles that break the
  ``"<name> <ICAO>"`` rule, so ``OutputHandler`` can surface them as GitHub
  Actions warnings - catching the bare-ICAO / ICAO-first regressions the older
  "no place name" heuristic misses.

It NEVER raises: a duplicate is dropped, everything else is kept and reported.
ICAO-less fields (name-only small strips) are legitimate and are neither
deduped nor flagged.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

from crawlers.models import Airport

# A well-formed ICAO location indicator is exactly four A-Z letters.
_ICAO_RE = re.compile(r"^[A-Z]{4}$")

_MAX_SAMPLES = 5  # cap the example lists carried into the log/annotation


@dataclass
class SanitizeReport:
    """What sanitize_airports observed for one country (for logging/annotations)."""

    country: str
    kept: int = 0
    icao_bearing: int = 0  # kept rows that carry an ICAO (denominator for ratios)
    dropped_duplicates: int = 0
    duplicate_samples: list[str] = field(default_factory=list)
    bad_icao: int = 0  # ICAO present but not exactly 4 letters
    bad_icao_samples: list[str] = field(default_factory=list)
    bad_title: int = 0  # ICAO-bearing title that does not end with the ICAO
    bad_title_samples: list[str] = field(default_factory=list)

    @property
    def bad_title_ratio(self) -> float:
        """Share of ICAO-bearing rows whose title breaks ``"<name> <ICAO>"``."""
        return self.bad_title / self.icao_bearing if self.icao_bearing else 0.0


def sanitize_airports(
    airports: list[Airport],
    country: str,
    logger: logging.Logger | None = None,
) -> tuple[list[Airport], SanitizeReport]:
    """Dedupe by ICAO and collect a quality report. Returns the cleaned list
    (duplicates removed, order preserved) plus the report. Never raises."""
    logger = logger or logging.getLogger(__name__)
    report = SanitizeReport(country=country.upper())
    seen: set[str] = set()
    out: list[Airport] = []

    for a in airports:
        icao = (a.icao or "").strip().upper()
        title = (a.title or "").strip()

        # ICAO-less fields (name-only strips) cannot be keyed - keep as-is.
        if not icao:
            out.append(a)
            continue

        # Dedup: first row for an ICAO wins; later ones are dropped.
        if icao in seen:
            report.dropped_duplicates += 1
            if len(report.duplicate_samples) < _MAX_SAMPLES:
                report.duplicate_samples.append(f"{title!r} ({icao})")
            continue
        seen.add(icao)

        report.icao_bearing += 1
        # Malformed ICAO (present but not 4 letters) - flag, keep.
        if not _ICAO_RE.match(icao):
            report.bad_icao += 1
            if len(report.bad_icao_samples) < _MAX_SAMPLES:
                report.bad_icao_samples.append(f"{title!r} ({icao})")
        # "<name> <ICAO>" rule: an ICAO-bearing title must end with the ICAO.
        elif not title.upper().endswith(icao):
            report.bad_title += 1
            if len(report.bad_title_samples) < _MAX_SAMPLES:
                report.bad_title_samples.append(f"{title!r}")

        out.append(a)

    report.kept = len(out)
    if report.dropped_duplicates:
        logger.warning(
            f"{report.country}: dropped {report.dropped_duplicates} duplicate "
            f"ICAO row(s) (e.g. {', '.join(report.duplicate_samples)})"
        )
    return out, report
