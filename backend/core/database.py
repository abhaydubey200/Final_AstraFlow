import os
import logging
import asyncio
from typing import Optional
from core.supabase_client import supabase_manager

logger = logging.getLogger(__name__)

class DatabaseManager:
    _instance: Optional['DatabaseManager'] = None

    def __init__(self, dsn: str = None):
        # We keep DSN for legacy compatibility, but internal ops use SDK
        self.dsn = dsn or os.getenv("DATABASE_URL")

    async def connect(self, min_size: int = 2, max_size: int = 10):
        """
        Initializes the Database layer.
        With the new architecture, we verify Supabase API connectivity instead of direct TCP.
        """
        logger.info("Initializing AstraFlow Production Database Layer...")
        
        # 1. Check if we're using Mock DB
        raw_mock = os.getenv("USE_MOCK_DB")
        use_mock = str(raw_mock or "").strip().lower().strip('"\'').strip()
        
        if use_mock == "true":
            logger.info("Database initialized in MOCK MODE")
            return

        # 2. Verify Supabase SDK Health
        try:
            is_healthy = await supabase_manager.check_health()
            if is_healthy:
                logger.info("PRODUCTION INFRA: Supabase HTTPS Bridge activated successfully.")
            else:
                logger.error("PRODUCTION INFRA: Supabase API unreachable via HTTPS.")
                raise RuntimeError("Failed to establish Supabase HTTPS bridge.")
        except Exception as e:
            logger.critical(f"PRODUCTION INFRA: Shutdown due to connectivity failure: {e}")
            raise

    async def disconnect(self):
        """Graceful shutdown (placeholder for SDK)."""
        logger.info("Supabase HTTPS Bridge disconnected.")

    async def health_check(self) -> bool:
        """Verifies database connectivity via SDK."""
        return await supabase_manager.check_health()

    @property
    def pool(self) -> None:
        """
        Deprecated in favor of SDK. 
        Will return None to signal that direct pool usage is forbidden for internal ops.
        """
        logger.warning("POOL ACCESS ATTEMPTED: Direct DB pool is deprecated for internal metadata.")
        return None

# Global instance for app lifecycle
db_manager = DatabaseManager()
