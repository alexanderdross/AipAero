from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Settings for aip:aero crawlers.
    """
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8')

    api_endpoint: str
    api_key: str
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
    log_file: str