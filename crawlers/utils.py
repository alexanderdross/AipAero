"""Shared crawler helpers.

Small, dependency-free utilities used across the crawler subsystem.
"""

import logging

def try_catch(func, *args, **kwargs):
    """
    A utility function to catch exceptions and return None.

    Wraps a call so a failing optional step (e.g. parsing one flaky field)
    logs the error and yields None instead of aborting the whole crawl.
    """
    try:
        return func(*args, **kwargs)
    except Exception as e:
        # Fail-soft: record the error, return None so the caller can continue.
        logging.error(e)
        return None