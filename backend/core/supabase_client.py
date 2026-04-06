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
    """
    Validates all required environment variables at startup.
    
    Raises:
        RuntimeError: If any required environment variable is missing or invalid.
    """
    required_vars = {
        "SUPABASE_URL": os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL"),
        "SUPABASE_SERVICE_ROLE_KEY": os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
        "SUPABASE_JWT_SECRET": os.getenv("SUPABASE_JWT_SECRET"),
        "ASTRAFLOW_MASTER_KEY": os.getenv("ASTRAFLOW_MASTER_KEY"),
    }
    
    # Check for missing variables
    missing = [name for name, value in required_vars.items() if not value]
    if missing:
        error_msg = f"Missing required environment variables: {', '.join(missing)}"
        logger.critical(f"ENV_VALIDATION_FAILED: {error_msg}")
        logger.critical("Please set all required variables in .env file")
        logger.critical("ASTRAFLOW_MASTER_KEY: Generate with 'openssl rand -hex 32'")
        raise RuntimeError(error_msg)
    
    # Validate SUPABASE_SERVICE_ROLE_KEY (should not be anon key)
    key = required_vars["SUPABASE_SERVICE_ROLE_KEY"]
    if "anon" in key.lower() or "publishable" in key.lower():
        error_msg = "Security violation: Backend must use SERVICE_ROLE_KEY, not anon/publishable key!"
        logger.critical(f"SUPABASE_FATAL: {error_msg}")
        raise RuntimeError(error_msg)
    
    # Validate ASTRAFLOW_MASTER_KEY format
    try:
        master_key_hex = required_vars["ASTRAFLOW_MASTER_KEY"]
        key_bytes = bytes.fromhex(master_key_hex)
        if len(key_bytes) != 32:
            raise ValueError(f"Must be 32 bytes (64 hex characters), got {len(key_bytes)} bytes")
    except ValueError as e:
        error_msg = f"Invalid ASTRAFLOW_MASTER_KEY: {e}"
        logger.critical(error_msg)
        raise RuntimeError(error_msg)
    
    logger.info("✅ Environment validation: PASSED")
    logger.info(f"  - Supabase URL: {required_vars['SUPABASE_URL']}")
    logger.info(f"  - JWT Secret: {'*' * 20}")
    logger.info(f"  - Master Key: {'*' * 20}")
    logger.info(f"  - Service Role Key: {'*' * 20}")

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
