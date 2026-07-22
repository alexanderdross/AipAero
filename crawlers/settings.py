"""Environment-based configuration for the crawler subsystem.

pydantic-settings reads these values from the process environment (set by the
GitHub Actions workflow) or a local `.env` file. Instantiating `Settings()`
with a missing/invalid value raises a `ValidationError`, which `main.py`
catches and reports.
"""

from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Settings for aip:aero crawlers.
    """
    # Case-insensitive env var names; fall back to a local `.env` file if present.
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8')

    api_endpoint: str  # Full URL of the website's /api/airports ingest endpoint
    # Bearer token (the website's CRON_SECRET) for API auth. SecretStr so a
    # stray repr(settings) / log of the object never leaks it; read the raw
    # value with .get_secret_value() (only in OutputHandler._send_with_retry).
    api_key: SecretStr
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]  # root logger level
    log_file: str  # Path of the file to also write logs to