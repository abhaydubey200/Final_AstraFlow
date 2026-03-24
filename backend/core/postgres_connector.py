import asyncpg
import os
import socket
import asyncio
import time
from typing import List, Dict, Any, Optional
from core.base_connector import BaseConnector
from core.healing_monitor import runtime_monitor

class PostgresConnector(BaseConnector):
    @classmethod
    def get_config_schema(cls) -> Dict[str, Any]:
        return {
            "title": "PostgreSQL Connection",
            "type": "object",
            "required": ["host", "user", "database"],
            "properties": {
                "host": {"title": "Host", "type": "string", "placeholder": "localhost"},
                "port": {"title": "Port", "type": "integer", "default": 5432},
                "user": {"title": "Username", "type": "string"},
                "password": {"title": "Password", "type": "string", "format": "password"},
                "database": {"title": "Database", "type": "string"},
                "ssl": {"title": "SSL Enabled", "type": "boolean", "default": False}
            }
        }

    @classmethod
    def get_capabilities(cls) -> Dict[str, Any]:
        return {
            "supports_cdc": True,
            "supports_incremental": True,
            "supports_parallel_reads": True,
            "supports_transactions": True,
            "max_connections": 100
        }

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.pool: Optional[asyncpg.Pool] = None

    @runtime_monitor.trace_and_heal(component="postgres")
    async def connect(self) -> bool:
        """Establish connection to Postgres. Only uses mock if host is explicitly a mock pattern."""
        host = self.config.get("host", "").lower()
        # The use_mock_env variable is not used for Postgres mock logic,
        # as mock is only enabled if the host explicitly matches a mock pattern.

        # Only use Mock if explicitly requested via host name
        if host in ["mock", "demo", "mock-server"]:
            print(f"Using Mock Postgres connection for {host}")
            self.pool = "MOCK_POOL"
            return True

        # Try real connection
        try:
            self.pool = await asyncio.wait_for(
                asyncpg.create_pool(
                    host=self.config.get("host"),
                    port=self.config.get("port"),
                    user=self.config.get("username"),
                    password=self.config.get("password"),
                    database=self.config.get("database"),
                    ssl='require' if self.config.get("ssl_enabled") else False,
                    min_size=1,
                    max_size=10
                ),
                timeout=10
            )
            print(f"Successfully connected to real Postgres server at {host}")
            return True
        except Exception as e:
            # No silent fallback to mock for real hosts
            print(f"Postgres connection error for {host}: {e}")
            return False

    async def health_check(self) -> bool:
        if self.pool is None:
            return False
        try:
            async with self.pool.acquire() as conn:
                await conn.execute("SELECT 1")
            return True
        except Exception:
            return False

    async def _acquire_connection(self) -> Any:
        if self.pool == "MOCK_POOL": return "MOCK_POOL"
        if not self.pool:
            await self.connect()
        return await self.pool.acquire()

    async def _release_connection(self, conn: Any):
        if conn == "MOCK_POOL": return
        if self.pool and conn:
            await self.pool.release(conn)

    @runtime_monitor.trace_and_heal(component="postgres")
    async def discover_schema(self) -> List[Dict[str, Any]]:
        async with self.connection() as conn:
            if conn == "MOCK_POOL":
                return [
                    {
                        "schema": "public", "name": "users", 
                        "columns": [
                            {"name": "id", "type": "uuid", "nullable": False, "is_primary_key": True},
                            {"name": "email", "type": "varchar(255)", "nullable": False},
                            {"name": "created_at", "type": "timestamp", "nullable": False}
                        ],
                        "primary_key": "id", "recommended_cursor": "created_at"
                    }
                ]

            query = """
            SELECT c.table_schema as schema, c.table_name as name, c.column_name, c.data_type, c.is_nullable,
                   (SELECT 1 FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                    WHERE tc.constraint_type = 'PRIMARY KEY' AND kcu.table_name = c.table_name 
                    AND kcu.table_schema = c.table_schema AND kcu.column_name = c.column_name LIMIT 1) as is_pk
            FROM information_schema.columns c
            WHERE c.table_schema NOT IN ('information_schema', 'pg_catalog')
            ORDER BY c.table_schema, c.table_name, c.ordinal_position;
            """
            rows = await conn.fetch(query)
            
            tables: Dict[str, Any] = {}
            for row in rows:
                table_key = f"{row['schema']}.{row['name']}"
                if table_key not in tables:
                    tables[table_key] = {"schema": row["schema"], "name": row["name"], "columns": [], "primary_key": None}
                
                is_pk = row.get("is_pk") == 1
                tables[table_key]["columns"].append({
                    "name": row["column_name"], "type": row["data_type"], 
                    "nullable": row["is_nullable"] == "YES", "is_primary_key": is_pk
                })
                if is_pk: tables[table_key]["primary_key"] = row["column_name"]
            return list(tables.values())

    @runtime_monitor.trace_and_heal(component="postgres")
    async def read_records(self, table_name: str, sync_mode: str, cursor: Optional[Any] = None) -> List[Dict[str, Any]]:
        async with self.connection() as conn:
            if conn == "MOCK_POOL": return []
                
            quoted_table = ".".join([f'"{p}"' for p in table_name.split(".")])
            query = f"SELECT * FROM {quoted_table}"
            params = []
            if sync_mode == "incremental" and cursor:
                query += " WHERE id > $1"
                params.append(cursor)
            
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]

    @runtime_monitor.trace_and_heal(component="postgres")
    async def write_records(self, table_name: str, records: List[Dict[str, Any]]) -> bool:
        if not records: return False
        async with self.connection() as conn:
            if conn == "MOCK_POOL": return True
            keys = list(records[0].keys())
            quoted_table = ".".join([f'"{p}"' for p in table_name.split(".")])
            columns = ", ".join([f'"{k}"' for k in keys])
            placeholders = ", ".join([f"${i+1}" for i in range(len(keys))])
            query = f"INSERT INTO {quoted_table} ({columns}) VALUES ({placeholders})"
            
            async with conn.transaction():
                data = [[record[k] for k in keys] for record in records]
                await conn.executemany(query, data)
            return True

    async def read_chunked(self, table_name: str, chunk_size: int, partition_config: Optional[Dict[str, Any]] = None):
        async with self.connection() as conn:
            if conn == "MOCK_POOL": return
            async with conn.transaction():
                quoted_table = ".".join([f'"{p}"' for p in table_name.split(".")])
                query = f"SELECT * FROM {quoted_table}"
                params = []
                if partition_config:
                    pk, start, end = partition_config.get('partition_key'), partition_config.get('range_start'), partition_config.get('range_end')
                    if pk and start is not None and end is not None:
                        query += f" WHERE \"{pk}\" >= $1 AND \"{pk}\" < $2"
                        params = [start, end]
                
                cur = await conn.cursor(query, *params)
                while True:
                    rows = await cur.fetch(chunk_size)
                    if not rows: break
                    yield [dict(row) for row in rows]

    async def discover_resources(self, target: str, **kwargs) -> List[Any]:
        async with self.connection() as conn:
            if conn == "MOCK_POOL":
                if target == "databases": return ["postgres", "test_db"]
                if target == "schemas": return ["public", "internal"]
                if target == "tables": return [{"name": "users", "database": "postgres", "schema": "public"}]
                return []

            if target == "databases":
                rows = await conn.fetch("SELECT datname FROM pg_database WHERE datistemplate = false")
                return [r['datname'] for r in rows]
            elif target == "schemas":
                rows = await conn.fetch("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog')")
                return [r['schema_name'] for r in rows]
            elif target == "tables":
                rows = await conn.fetch("SELECT table_name, table_schema FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog')")
                return [{"name": r['table_name'], "database": self.config.get("database"), "schema": r['table_schema']} for r in rows]
            return []

    async def diagnose(self) -> Dict[str, Any]:
        """Perform deep diagnostics for Postgres connection."""
        import time
        import socket
        report = {"dns_resolution": "pending", "tcp_connection": "pending", "authentication": "pending", "status": "pending", "latency_ms": 0}
        start = time.time()
        try:
            host = self.config.get("host", "")
            if not self._is_mock():
                socket.gethostbyname(host)
            report["dns_resolution"] = "success"
            
            if not self._is_mock():
                s = socket.create_connection((host, int(self.config.get("port", 5432))), timeout=5)
                s.close()
            report["tcp_connection"] = "success"
            
            if await self.health_check():
                report["authentication"] = "success"
                report["status"] = "healthy"
            else:
                report["authentication"] = "failed"
                report["status"] = "unhealthy"
        except Exception as e:
            report["status"] = f"failed: {str(e)}"
        
        report["latency_ms"] = int((time.time() - start) * 1000)
        return report

    async def disconnect(self):
        if self.pool is not None and self.pool != "MOCK_POOL":
            await self.pool.close()
        self.pool = None


