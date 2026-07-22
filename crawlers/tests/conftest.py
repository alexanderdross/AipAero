"""Shared pytest fixtures for the crawler suite."""

from __future__ import annotations

import pytest

from crawlers import http_cache


@pytest.fixture(autouse=True)
def _isolate_http_cache(monkeypatch):
    """Keep every test hermetic + filesystem-free by default: the HTTP
    conditional-GET cache is disabled unless a test explicitly opts in (by
    unsetting CRAWLER_NO_HTTP_CACHE + pointing CRAWLER_HTTP_CACHE_DIR at a
    tmp_path and calling http_cache.reset_shared_cache()). The process-wide
    singleton is reset around each test so state never leaks between them."""
    monkeypatch.setenv("CRAWLER_NO_HTTP_CACHE", "1")
    http_cache.reset_shared_cache()
    yield
    http_cache.reset_shared_cache()
