"""Environment-based configuration for the health collector.

Kept separate from the crawler `Settings` (crawlers/settings.py) so the
collector can run WITHOUT the crawler's mandatory fields (log_file, the
/api/airports endpoint, ...) and so every source token stays optional: a run
with no Cloudflare/Coolify/GitHub/Sentry credentials still collects the local
host metrics and simply skips the unconfigured sources (fail-soft).

All fields are optional. Without `api_key` the collector runs in DRY-RUN mode
(gathers + logs, but does not POST). The tokens are `SecretStr` so a stray
repr/log of the settings object never leaks them.
"""

from __future__ import annotations

from typing import Optional

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class HealthSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- Website ingest ---
    # Base URL of the website (the collector POSTs to {api_base}/api/health).
    api_base: str = "https://aip.aero"
    # Bearer token = the website's CRON_SECRET (same as the crawler API_KEY).
    # Optional: unset -> dry-run (no publish).
    api_key: Optional[SecretStr] = None
    log_level: str = "INFO"

    # --- Cloudflare (Workers health / traffic / Web Vitals / D1) ---
    cloudflare_account_id: Optional[str] = None
    cloudflare_zone_id: Optional[str] = None
    # Read-only API token scoped to Analytics + D1 read.
    cloudflare_analytics_token: Optional[SecretStr] = None
    # D1 database id (for the D1 REST size read); defaults to the app DB.
    cloudflare_d1_database_id: Optional[str] = None
    # The Worker script name whose invocations we sample.
    cloudflare_worker_name: str = "aip-aero"

    # --- Coolify (container/app/server stats on the box) ---
    coolify_api_url: Optional[str] = None  # e.g. http://localhost:8000
    coolify_api_token: Optional[SecretStr] = None

    # --- GitHub (open issues + failed workflow runs) ---
    github_token: Optional[SecretStr] = None
    github_repo: str = "alexanderdross/aipaero"  # owner/repo

    # --- Sentry (unresolved issues + event counts) ---
    sentry_auth_token: Optional[SecretStr] = None
    sentry_org: Optional[str] = None
    sentry_project: Optional[str] = None

    # --- Alerting (push a notification when a metric goes crit) ---
    # An ntfy topic URL (e.g. https://ntfy.sh/aip-aero-health-<random>). Unset ->
    # alerting is INERT (the collector still runs, it just never notifies), so
    # deploying the code notifies nothing until a channel is provisioned.
    alert_ntfy_url: Optional[str] = None
    # Re-alert cadence while a metric STAYS crit (hours) - avoids a per-run storm.
    alert_cooldown_hours: float = 6.0
    # Where the debounce state persists across runs (a box-local file, like the
    # crawlers' last_run_counts.json). Relative to the collector's working dir.
    alert_state_file: str = "health_alert_state.json"
