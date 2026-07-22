"""Shared metric model + helper for the health collector.

A `Metric` maps 1:1 onto one row of the website's `healthMetricsApiInsertSchema`
(drizzle-zod). The website's Zod schema keys are the drizzle *property* names
(camelCase: `recordedAt`), NOT the SQL column names - exactly like the airports
ingest sends `pdfUrl`. `to_payload()` emits that camelCase shape.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Optional

# Coarse dashboard grouping. Free-form on the DB side, but we keep the known set
# here so the gatherers agree on spelling (a typo would just create a stray tile).
Category = str  # "cloudflare" | "server" | "coolify" | "database" | "crawl" | "issues" | "vitals"


@dataclass
class Metric:
    """One sampled metric = one health_metrics row."""

    category: Category
    metric: str
    value: Optional[float] = None
    unit: Optional[str] = None  # "ms" | "pct" | "bytes" | "count" | "ratio" | "s"
    scope: Optional[str] = None  # country / path / worker / service / source
    status: Optional[str] = None  # "ok" | "warn" | "crit"
    meta: Optional[dict[str, Any]] = None
    recorded_at: Optional[int] = None  # unix seconds; defaults to now at build time

    def to_payload(self) -> dict[str, Any]:
        import json

        return {
            "recordedAt": self.recorded_at
            if self.recorded_at is not None
            else int(time.time()),
            "category": self.category,
            "metric": self.metric,
            "value": self.value,
            "unit": self.unit,
            "scope": self.scope,
            "status": self.status,
            # The DB column is a text blob; serialise any structured detail.
            "meta": json.dumps(self.meta, separators=(",", ":"))
            if self.meta is not None
            else None,
        }
