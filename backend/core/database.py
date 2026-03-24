import asyncpg
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class DatabaseManager:
    _instance: Optional['DatabaseManager'] = None
    _pool: Optional[asyncpg.Pool] = None

    def __init__(self, dsn: str = None):
        self.dsn = dsn or os.getenv("DATABASE_URL")

    async def connect(self, min_size: int = 10, max_size: int = 50):
        """Initializes the connection pool."""
        raw_mock = os.getenv("USE_MOCK_DB")
        use_mock = str(raw_mock or "").strip().lower().strip('"\'').strip()
        print(f"DEBUG_INFRA: USE_MOCK_DB raw='{raw_mock}', normalized='{use_mock}'")
        if use_mock == "true":
            if not self._pool:
                import mock_db
                self._pool = await mock_db.mock_pg.create_pool()
                logger.info("Database connection pool initialized with MockDB")
            return

        if not self.dsn:
            self.dsn = os.getenv("DATABASE_URL")
        
        if not self.dsn:
            raise ValueError("DATABASE_URL environment variable is required")
        
        if not self._pool:
            try:
                self._pool = await asyncpg.create_pool(
                    dsn=self.dsn,
                    min_size=min_size,
                    max_size=max_size,
                    command_timeout=60,
                    max_queries=50000,
                    max_inactive_connection_lifetime=300
                )
                logger.info(f"Database connection pool initialized (min={min_size}, max={max_size})")
            except Exception as e:
                logger.error(f"Failed to create database pool: {e}")
                raise

    async def disconnect(self):
        """Closes the connection pool."""
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("Database connection pool closed")

    async def health_check(self) -> bool:
        """Verifies database connectivity."""
        if not self._pool:
            return False
        try:
            async with self._pool.acquire() as conn:
                await conn.execute("SELECT 1")
                return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False

    @property
    def pool(self) -> asyncpg.Pool:
        if not self._pool:
            raise RuntimeError("Database pool not initialized. Call connect() first.")
        return self._pool

# Global instance for app lifecycle
db_manager = DatabaseManager()
