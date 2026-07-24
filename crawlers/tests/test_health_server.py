"""Tests for the health server gatherer's threshold classification.

`_status` is the pure part that gives the server metrics an ok/warn/crit status
(previously they shipped status=None, so the dashboard banner read "all normal"
even at saturation). The psutil-backed `gather()` is exercised live on the box.
"""

from __future__ import annotations

from health.server import _status


def test_status_thresholds():
    # below warn -> ok
    assert _status(10, 85, 95) == "ok"
    assert _status(84.9, 85, 95) == "ok"
    # warn band (>= warn, < crit)
    assert _status(85, 85, 95) == "warn"
    assert _status(94.9, 85, 95) == "warn"
    # crit band (>= crit)
    assert _status(95, 85, 95) == "crit"
    assert _status(100, 85, 95) == "crit"


def test_status_ratio_thresholds():
    # per-core load: 1.0 warn, 2.0 crit
    assert _status(0.5, 1.0, 2.0) == "ok"
    assert _status(1.0, 1.0, 2.0) == "warn"
    assert _status(2.5, 1.0, 2.0) == "crit"
