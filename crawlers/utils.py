import logging

def try_catch(func, *args, **kwargs):
    """
    A utility function to catch exceptions and return None.
    """
    try:
        return func(*args, **kwargs)
    except Exception as e:
        logging.error(e)
        return None