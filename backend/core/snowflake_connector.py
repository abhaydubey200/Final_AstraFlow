try:
    import snowflake.connector
    has_snowflake = True
    try:
        from snowflake.connector.pooling import SnowflakeConnectionPool
        has_pooling = True
    except ImportError:
        has_pooling = False
except ImportError:
    has_snowflake = False
    has_pooling = False
import os
import socket
import asyncio
import logging
import uuid
from typing import List, Dict, Any, Optional
from core.base_connector import BaseConnector
from core.healing_monitor import runtime_monitor

logger = logging.getLogger(__name__)

class SnowflakeConnector(BaseConnector):
    @classmethod
    def get_config_schema(cls) -> Dict[str, Any]:
        return {
            "title": "Snowflake Connection",
            "type": "object",
            "required": ["host", "user", "database", "warehouse"],
            "properties": {
                "host": {"title": "Account URL", "type": "string", "placeholder": "xy12345.snowflakecomputing.com"},
                "user": {"title": "Username", "type": "string"},
                "password": {"title": "Password", "type": "string", "format": "password"},
                "database": {"title": "Database", "type": "string"},
                "warehouse": {"title": "Warehouse", "type": "string"},
                "role": {"title": "Role", "type": "string", "default": "PUBLIC"},
                "port": {"title": "Port", "type": "integer", "default": 443},
                "schema": {"title": "Schema", "type": "string", "default": "PUBLIC"}
            }
        }

    @classmethod
    def get_capabilities(cls) -> Dict[str, Any]:
        return {
            "supports_cdc": False,
            "supports_incremental": True,
            "supports_parallel_reads": True,
            "supports_transactions": True,
            "max_connections": 50
        }

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.conn: Any = None
        self._pool = None
        self._heartbeat_task = None

    @runtime_monitor.trace_and_heal(component="snowflake")
    async def connect(self) -> bool:
        """Initialize Snowflake pool or direct connection."""
        host = (self.config.get("host") or "").lower()

        if self._is_mock():
            logger.info(f"Using Mock Snowflake connection for {host}")
            self.conn = "MOCK_CONN"
            return True

        try:
            conn_params = {
                "user": self.config.get("user") or self.config.get("username"),
                "password": self.config.get("password"),
                "account": self.config.get("host") or self.config.get("account"),
                "port": self.config.get("port", 443),
                "warehouse": self.config.get("warehouse"),
                "database": self.config.get("database"),
                "role": self.config.get("role", "PUBLIC"),
                "schema": self.config.get("schema", "PUBLIC")
            }
            
            if has_pooling:
                self._pool = SnowflakeConnectionPool(
                    connection_name=f"astra_pool_{uuid.uuid4().hex[:8]}",
                    pool_size=5,
                    **conn_params
                )
                logger.info("Snowflake pooled connection initialized.")
            else:
                self._conn_params = conn_params
                logger.info("Snowflake pooling not available; using direct connections.")
            
            self._heartbeat_task = asyncio.create_task(self._start_heartbeat())
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Snowflake connection for {host}: {e}")
            return False

    async def _acquire_connection(self) -> Any:
        if self.conn == "MOCK_CONN": return "MOCK_CONN"
        if has_pooling and self._pool:
            return await asyncio.to_thread(self._pool.get_connection)
        
        # Fallback: direct connection
        if not hasattr(self, "_conn_params") or not self._conn_params:
            await self.connect()
        return await asyncio.to_thread(snowflake.connector.connect, **self._conn_params)

    async def _release_connection(self, conn: Any):
        if conn == "MOCK_CONN": return
        if conn:
            await asyncio.to_thread(conn.close)

    async def _start_heartbeat(self):
        """Periodic heartbeat to keep pooled sessions alive."""
        while self._pool:
            try:
                async with self.connection() as conn:
                    if conn != "MOCK_CONN":
                        await asyncio.to_thread(conn.cursor().execute, "SELECT 1")
                await asyncio.sleep(300)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Snowflake heartbeat failed: {e}")
                await asyncio.sleep(10)

    async def disconnect(self):
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
        self._pool = None
        self.conn = None

    async def discover_resources(self, target: str, **kwargs) -> List[Any]:
        """Discover Snowflake resources."""
        database_context = kwargs.get("database_name")
        async with self.connection() as conn:
            if conn == "MOCK_CONN":
                if target == "warehouses": return ["COMPUTE_WH", "DEMO_WH", "ANALYTICS_WH"]
                if target == "databases": return ["DS_GROUP_HR_DB", "SNOWFLAKE_SAMPLE_DATA", "UTIL_DB", "SALES_ANALYTICS"]
                if target == "schemas": return ["PUBLIC", "INFORMATION_SCHEMA", "STAGING", "RAW"]
                if target == "tables":
                    db = database_context or "DS_GROUP_HR_DB"
                    return [{"name": "USERS", "database": db, "schema": "PUBLIC"}]
                return []

            import snowflake.connector
            with conn.cursor() as cursor:
                try:
                    if target == "warehouses":
                        cursor.execute("SHOW WAREHOUSES")
                        return [r[0] for r in cursor.fetchall()]
                    elif target == "databases":
                        cursor.execute("SHOW DATABASES")
                        return [r[1] for r in cursor.fetchall()]
                    elif target == "schemas":
                        db = database_context or self.config.get("database")
                        if db:
                            # Log the DB being used for discovery
                            logger.info(f"Discovering schemas in Snowflake database: {db}")
                            # Quote correctly: escape existing double quotes
                            db_safe = db.replace('"', '""')
                            try:
                                cursor.execute(f'SHOW SCHEMAS IN DATABASE "{db_safe}"')
                            except snowflake.connector.errors.ProgrammingError as e:
                                logger.warning(f"Quoted SHOW SCHEMAS failed for '{db}', trying unquoted: {e}")
                                # Only try unquoted if the error wasn't about the hyphen itself
                                cursor.execute(f'SHOW SCHEMAS IN DATABASE {db}')
                            return [r[1] for r in cursor.fetchall()]
                    elif target == "tables":
                        db = database_context or self.config.get("database")
                        if db:
                            logger.info(f"Discovering tables in Snowflake database: {db}")
                            db_safe = db.replace('"', '""')
                            try:
                                cursor.execute(f'SHOW TABLES IN DATABASE "{db_safe}"')
                            except snowflake.connector.errors.ProgrammingError as e:
                                logger.warning(f"Quoted SHOW TABLES failed for '{db}', trying unquoted: {e}")
                                cursor.execute(f'SHOW TABLES IN DATABASE {db}')
                            return [{"name": r[1], "database": r[2], "schema": r[3]} for r in cursor.fetchall()]
                except snowflake.connector.errors.ProgrammingError as e:
                    logger.error(f"Snowflake discovery error for {target}: {e}")
                    raise
                return []

    async def health_check(self) -> bool:
        try:
            async with self.connection() as conn:
                if conn == "MOCK_CONN": return True
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1")
                    return cursor.fetchone() is not None
        except Exception:
            return False

    @runtime_monitor.trace_and_heal(component="snowflake")
    async def discover_schema(self) -> List[Dict[str, Any]]:
        async with self.connection() as conn:
            if conn == "MOCK_CONN":
                return [
                    {
                        "schema": "PUBLIC", "name": "USERS", 
                        "columns": [
                            {"name": "ID", "type": "NUMBER", "nullable": False, "is_primary_key": True},
                            {"name": "EMAIL", "type": "TEXT", "nullable": False},
                            {"name": "CREATED_AT", "type": "TIMESTAMP_NTZ", "nullable": False}
                        ],
                        "primary_key": "ID"
                    },
                    {
                        "schema": "PUBLIC", "name": "ORDERS", 
                        "columns": [
                            {"name": "ID", "type": "NUMBER", "nullable": False, "is_primary_key": True},
                            {"name": "USER_ID", "type": "NUMBER", "nullable": False},
                            {"name": "AMOUNT", "type": "FLOAT", "nullable": False}
                        ],
                        "primary_key": "ID"
                    }
                ]
            
            db_name = self.config.get("database")
            import snowflake.connector
            with conn.cursor() as cursor:
                if not db_name:
                    cursor.execute("SELECT CURRENT_DATABASE()")
                    db_row = cursor.fetchone()
                    db_name = db_row[0] if db_row else None
                
                if not db_name: return []

                try:
                    cursor.execute(f'SHOW TABLES IN DATABASE "{db_name}"')
                except snowflake.connector.errors.ProgrammingError:
                    try:
                        cursor.execute(f'SHOW TABLES IN DATABASE {db_name}')
                    except snowflake.connector.errors.ProgrammingError:
                        cursor.execute(f'SHOW TABLES IN DATABASE "{db_name.upper()}"')
                
                rows = cursor.fetchall()
                
                tables = []
                for row in rows:
                    if row[2].upper() == 'INFORMATION_SCHEMA': continue
                    with conn.cursor() as col_cur:
                        col_cur.execute(f'DESC TABLE "{db_name.upper()}"."{row[2]}"."{row[1]}"')
                        col_rows = col_cur.fetchall()
                        columns = [{"name": c[0], "type": c[1], "nullable": c[3] == 'Y', "is_primary_key": c[5] == 'Y'} for c in col_rows]
                        tables.append({
                            "schema": row[2], "name": row[1], "columns": columns,
                            "primary_key": next((c["name"] for c in columns if c["is_primary_key"]), None)
                        })
                return tables

    @runtime_monitor.trace_and_heal(component="snowflake")
    async def read_records(self, table_name: str, sync_mode: str, cursor: Optional[Any] = None) -> List[Dict[str, Any]]:
        async with self.connection() as conn:
            if conn == "MOCK_CONN":
                return [{"ID": 1, "EMAIL": "mock@astraflow.ai", "CREATED_AT": "2024-01-01"}]
            with conn.cursor() as cur:
                quoted = ".".join([f'"{p}"' for p in table_name.split(".")])
                query = f"SELECT * FROM {quoted}"
                if sync_mode == "incremental" and cursor:
                    query += ' WHERE "id" > %s'
                    cur.execute(query, (cursor,))
                else: cur.execute(query)
                cols = [c[0] for c in cur.description]
                return [dict(zip(cols, r)) for r in cur.fetchall()]

    async def read_chunked(self, table_name: str, chunk_size: int, partition_config: Optional[Dict[str, Any]] = None):
        async with self.connection() as conn:
            if conn == "MOCK_CONN":
                yield [{"ID": 1, "EMAIL": "mock@astraflow.ai", "CREATED_AT": "2024-01-01"}]
                return
            with conn.cursor() as cur:
                quoted = ".".join([f'"{p}"' for p in table_name.split(".")])
                query = f"SELECT * FROM {quoted}"
                params = []
                if partition_config:
                    pk, start, end = partition_config.get('partition_key'), partition_config.get('range_start'), partition_config.get('range_end')
                    if pk and start is not None and end is not None:
                        query += f' WHERE "{pk}" >= %s AND "{pk}" < %s'
                        params = [start, end]
                cur.execute(query, params)
                cols = [c[0] for c in cur.description]
                while True:
                    rows = cur.fetchmany(chunk_size)
                    if not rows: break
                    yield [dict(zip(cols, r)) for r in rows]

    @runtime_monitor.trace_and_heal(component="snowflake")
    async def write_records(self, table_name: str, records: List[Dict[str, Any]]) -> bool:
        if not records: return False
        async with self.connection() as conn:
            if conn == "MOCK_CONN": return True
            with conn.cursor() as cur:
                keys = list(records[0].keys())
                quoted = ".".join([f'"{p}"' for p in table_name.split(".")])
                columns = ", ".join([f'"{k}"' for k in keys])
                placeholders = ", ".join(["%s"] * len(keys))
                query = f"INSERT INTO {quoted} ({columns}) VALUES ({placeholders})"
                cur.executemany(query, [[r[k] for k in keys] for r in records])
                return True

    async def diagnose(self) -> Dict[str, Any]:
        """Perform deep diagnostics."""
        import time
        report = {"dns_resolution": "pending", "tcp_connection": "pending", "authentication": "pending", "status": "pending", "latency_ms": 0}
        start = time.time()
        try:
            account = self.config.get("host", "")
            host = account if ".snowflakecomputing.com" in account else f"{account}.snowflakecomputing.com"
            if not self._is_mock(): socket.gethostbyname(host)
            report["dns_resolution"] = "success"
            if not self._is_mock():
                s = socket.create_connection((host, int(self.config.get("port", 443))), timeout=5)
                s.close()
            report["tcp_connection"] = "success"
            if await self.health_check():
                report["authentication"] = "success"
                report["status"] = "healthy"
            else:
                report["authentication"] = "failed"
                report["status"] = "unhealthy"
        except Exception as e: report["status"] = f"failed: {str(e)}"
        report["latency_ms"] = int((time.time() - start) * 1000)
        return report
