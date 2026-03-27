import time
import functools
import logging
import asyncio
from typing import Any, Callable, TypeVar, Union

logger = logging.getLogger("astra.decorators")

T = TypeVar("T")

def safe_execute(max_retries: int = 2, initial_delay: float = 1.0):
    """
    Phase 5 & 7: Safe Execution Wrapper with Retry and RLS Protection.
    
    Args:
        max_retries: Maximum number of retry attempts.
        initial_delay: Initial delay for exponential backoff.
    """
    def decorator(func: Callable[..., Any]):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            last_exception = None
            delay = initial_delay
            
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    error_msg = str(e).lower()
                    
                    # Phase 5: Categorize RLS violations
                    if "row-level security" in error_msg or "42501" in error_msg:
                        logger.critical(f"RLS_VIOLATION: Operation blocked by policy - {func.__name__}")
                        raise RuntimeError(f"Security violation (RLS): {str(e)}")
                    
                    # Phase 7: Retry logic for transient failures (timeouts, connection resets)
                    transient_errors = ["timeout", "connection", "503", "502", "reset", "closed"]
                    is_transient = any(err in error_msg for err in transient_errors)
                    
                    if attempt < max_retries and is_transient:
                        logger.warning(f"TRANSIENT_ERROR: {str(e)} - Retrying in {delay}s (Attempt {attempt + 1}/{max_retries})")
                        await asyncio.sleep(delay)
                        delay *= 2  # Exponential backoff
                    else:
                        logger.error(f"FINAL_ERROR: {func.__name__} failed after {attempt} retries: {str(e)}")
                        raise last_exception
            
            raise last_exception # Should not be reachable

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            # Similar logic for sync functions if needed
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if "row-level security" in str(e).lower():
                    raise RuntimeError(f"Security violation (RLS): {str(e)}")
                raise

        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    return decorator
