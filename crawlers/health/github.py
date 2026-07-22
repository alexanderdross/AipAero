"""GitHub metrics gatherer - open issues + failed workflow runs.

Skeleton (Phase 1): counts open issues and recent failed Actions runs for the
repo. Fully fail-soft: unconfigured or any error -> []. A token raises the rate
limit and reaches private repos; the counts are emitted under category "issues"
so they land on the dashboard's Issues tile alongside CF error rate, crawl
anomalies and Sentry.
"""

from __future__ import annotations

import logging
from typing import List

from .models import Metric
from .settings import HealthSettings

log = logging.getLogger(__name__)

_API = "https://api.github.com"
# Workflows whose failures matter for system health.
_WATCHED_WORKFLOWS = ("crawl.yml", "facts-import.yml", "cd.yml", "ci.yml")


def gather(settings: HealthSettings) -> List[Metric]:
    token = settings.github_token
    repo = settings.github_repo
    if not token or not repo:
        log.info("github gatherer: no token/repo configured; skipping")
        return []

    metrics: List[Metric] = []
    try:
        import httpx

        headers = {
            "Authorization": f"Bearer {token.get_secret_value()}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        with httpx.Client(timeout=20.0, base_url=_API, headers=headers) as client:
            # Open issues (search API returns total_count; excludes PRs).
            try:
                r = client.get(
                    "/search/issues",
                    params={"q": f"repo:{repo} is:issue is:open", "per_page": 1},
                )
                r.raise_for_status()
                metrics.append(
                    Metric(
                        "issues",
                        "open_issues",
                        float(r.json().get("total_count", 0)),
                        "count",
                        scope="github",
                    )
                )
            except Exception as e:
                log.warning("github gatherer: open-issue count failed (%s)", e)

            # Latest run conclusion per watched workflow (failure = warn/crit).
            failed = 0
            for wf in _WATCHED_WORKFLOWS:
                try:
                    r = client.get(
                        f"/repos/{repo}/actions/workflows/{wf}/runs",
                        params={"per_page": 1, "status": "completed"},
                    )
                    r.raise_for_status()
                    runs = r.json().get("workflow_runs", [])
                    if runs and runs[0].get("conclusion") not in ("success", None):
                        failed += 1
                except Exception as e:
                    log.warning("github gatherer: %s runs read failed (%s)", wf, e)
            metrics.append(
                Metric(
                    "issues",
                    "ci_failed",
                    float(failed),
                    "count",
                    scope="github",
                    status="ok" if failed == 0 else "crit",
                )
            )
    except Exception as e:
        log.warning("github gatherer: read failed (%s)", e)

    log.info("github gatherer: collected %d metrics", len(metrics))
    return metrics
