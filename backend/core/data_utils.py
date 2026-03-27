import time
import functools
import logging
from typing import Any, Callable, Dict
from cachetools import TTLCache
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger("astra.utils")

# 1. RATE LIMITING SETUP
# Global limiter using client IP as key
limiter = Limiter(key_func=get_remote_address)

# 2. CACHING LAYER
# Simple in-memory cache with 60-second default TTL
# maxsize=100 means we cache up to 100 unique result sets
_data_cache = TTLCache(maxsize=100, ttl=60)

def cached_supabase_call(ttl: int = 60):
    """
    Decorator to cache Supabase GET/READ results.
    Args:
        ttl: Time-to-live in seconds (default 60s).
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Create a cache key from function name + args + kwargs
            # This ensures 'list_pipelines(user_id=1)' is cached separately from user_id=2
            cache_key = f"{func.__name__}:{str(args)}:{str(kwargs)}"
            
            if cache_key in _data_cache:
                logger.info(f"CACHE: Hit for {cache_key}")
                return _data_cache[cache_key]
            
            logger.info(f"CACHE: Miss for {cache_key}, fetching from Supabase...")
            result = await func(*args, **kwargs)
            _data_cache[cache_key] = result
            return result
        return wrapper
    return decorator

def invalidate_cache(prefix: str):
    """Manual cache invalidation for when data is updated/deleted."""
    keys_to_delete = [k for k in _data_cache.keys() if k.startswith(prefix)]
    for k in keys_to_delete:
        del _data_cache[k]
    logger.info(f"CACHE: Invalidated {len(keys_to_delete)} keys with prefix '{prefix}'")
