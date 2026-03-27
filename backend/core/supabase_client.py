import os
import logging
import time
import functools
from typing import Optional, Any
from supabase import create_client, Client
from dotenv import load_dotenv

# Ensure env is loaded from the root directory
# Since we are in backend/core/, the .env is at ../../.env
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

logger = logging.getLogger("astra.supabase")

def supabase_logger(func):
    """Decorator to log Supabase API calls with latency and status."""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        table_name = kwargs.get('table_name', 'unknown')
        method = func.__name__.upper()
        
        try:
            logger.info(f"SUPABASE_API: Starting {method} on {table_name}")
            result = await func(*args, **kwargs)
            latency = (time.time() - start_time) * 1000
            logger.info(f"SUPABASE_API: SUCCESS {method} on {table_name} ({latency:.2f}ms)")
            return result
        except Exception as e:
            latency = (time.time() - start_time) * 1000
            logger.error(f"SUPABASE_API: ERROR {method} on {table_name} after {latency:.2f}ms: {str(e)}")
            raise
    return wrapper

def validate_env():
    """Phase 3: Global Configuration Validation"""
    url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url:
        logger.critical("SUPABASE_FATAL: SUPABASE_URL is missing!")
        raise RuntimeError("Missing Supabase URL configuration")

    if not key:
        logger.critical("SUPABASE_FATAL: SUPABASE_SERVICE_ROLE_KEY is missing!")
        raise RuntimeError("Missing SERVICE ROLE KEY")

    if "anon" in key.lower() or "publishable" in key.lower():
        logger.critical("SUPABASE_FATAL: Security violation: Backend using anon key!")
        raise RuntimeError("Invalid key: anon key used in backend")
    
    logger.info("Supabase environment validation: PASSED")

def create_client_strict() -> Client:
    """Phase 2: Centralized Supabase Client (Single Source of Truth)"""
    validate_env()
    
    url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    try:
        client = create_client(url, key)
        logger.info(f"Supabase client initialized via HTTPS (Strict Mode) - Project: {url}")
        return client
    except Exception as e:
        logger.error(f"Supabase client initialization failed: {e}")
        raise RuntimeError(f"Failed to initialize Supabase client: {e}")

# Phase 2: Single Source of Truth
supabase: Client = create_client_strict()

# Compatibility Layer for existing code using SupabaseManager
class SupabaseManager:
    """Legacy wrapper for backward compatibility."""
    def __init__(self):
        self._client = supabase

    def client(self) -> Client:
        return self._client

    async def check_health(self) -> bool:
        """Lightweight check to ensure API connectivity."""
        try:
            supabase.table("pipelines").select("id", count="exact").limit(1).execute()
            return True
        except Exception as e:
            logger.error(f"Supabase API health check failed: {e}")
            return False

# Global instances
supabase_manager = SupabaseManager()
get_supabase = supabase_manager.client
