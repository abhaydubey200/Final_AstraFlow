import uuid
from typing import Dict, Any, List
from core.supabase_client import supabase, supabase_logger
from core.decorators import safe_execute
from core.base_connector import BaseConnector
from core.postgres_connector import PostgresConnector
from core.snowflake_connector import SnowflakeConnector
from core.mssql_connector import MSSQLConnector
from core.mysql_connector import MySQLConnector

class CapabilityService:
    def __init__(self, pool: Any = None):
        # Using Supabase SDK for all operations (Phase 2 Migration)
        self.supabase = supabase

    @safe_execute()
    async def detect_capabilities(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Phase 2 Migration: Detect database capabilities."""
        connector_type = config.get("type")
        connection_id = config.get("connection_id")
        
        # Default capabilities
        caps = {
            "supports_cdc": False,
            "supports_incremental": True,
            "supports_parallel_reads": False,
            "supports_transactions": True,
            "max_connections": 10
        }

        # Type-specific overrides
        if connector_type == "postgresql":
            caps.update({"supports_cdc": True, "supports_parallel_reads": True, "max_connections": 100})
        elif connector_type == "snowflake":
            caps.update({"supports_cdc": True, "supports_parallel_reads": True, "max_connections": 50})
        elif connector_type == "mysql":
            caps.update({"supports_cdc": True, "max_connections": 150})
        elif connector_type in ("mssql", "sqlserver"):
            caps.update({"supports_cdc": True, "max_connections": 100})

        if connection_id:
            await self.save_capabilities(connection_id, caps)
            
        return caps

    @safe_execute()
    async def save_capabilities(self, connection_id: str, caps: Dict[str, Any]):
        """Phase 2 Migration: Save capabilities via SDK."""
        self.supabase.table("connection_capabilities").upsert({
            "connection_id": connection_id,
            "supports_cdc": caps.get("supports_cdc", False),
            "supports_incremental": caps.get("supports_incremental", True),
            "supports_parallel_reads": caps.get("supports_parallel_reads", False),
            "supports_transactions": caps.get("supports_transactions", True),
            "max_connections": caps.get("max_connections", 10)
        }).execute()

    @safe_execute()
    async def get_capabilities(self, connection_id: str) -> Dict[str, Any]:
        """Phase 2 Migration: Get capabilities via SDK."""
        res = self.supabase.table("connection_capabilities").select("*").eq("connection_id", connection_id).execute()
        return res.data[0] if res.data else {}
