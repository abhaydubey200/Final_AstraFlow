try:
    import mysql.connector
    from mysql.connector.pooling import MySQLConnectionPool
    has_mysql = True
except ImportError:
    has_mysql = False
    class MySQLConnectionPool: pass # Placeholder for type hinting
import os
import asyncio
from typing import List, Dict, Any, Optional
from core.base_connector import BaseConnector
from core.healing_monitor import runtime_monitor

class MySQLConnector(BaseConnector):
    """MySQL connector using pooled connections."""

    @classmethod
    def get_config_schema(cls) -> Dict[str, Any]:
        return {
            "title": "MySQL Connection",
            "type": "object",
            "required": ["host", "user", "database"],
            "properties": {
                "host": {"title": "Host", "type": "string", "placeholder": "localhost"},
                "port": {"title": "Port", "type": "integer", "default": 3306},
                "user": {"title": "Username", "type": "string"},
                "password": {"title": "Password", "type": "string", "format": "password"},
                "database": {"title": "Database", "type": "string"}
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
        self.pool: Optional[MySQLConnectionPool] = None

    @runtime_monitor.trace_and_heal(component="mysql")
    async def connect(self) -> bool:
        """Establish connection to MySQL. Only uses mock if host is explicitly a mock pattern."""
        host = (self.config.get("host") or "").lower()

        # Only use Mock if explicitly requested via host name or if in mock mode
        if self._is_mock():
            print(f"Using Mock MySQL connection for {host}")
            self.pool = "MOCK_POOL"
            return True

        # Try real connection
        try:
            pool_name = f"pool_{self.config.get('host')}_{self.config.get('database')}"
            self.pool = MySQLConnectionPool(
                pool_name=pool_name,
                pool_size=5,
                host=self.config.get("host", "localhost"),
                port=int(self.config.get("port", 3306)),
                database=self.config.get("database"),
                user=self.config.get("user") or self.config.get("username"),
                password=self.config.get("password", ""),
            )
            print(f"Successfully connected to real MySQL server at {host}")
            return True
        except Exception as e:
            # No silent fallback to mock for real hosts
            print(f"MySQL connection pool error for {host}: {e}")
            return False

    async def _acquire_connection(self) -> Any:
        if self.pool == "MOCK_POOL": return "MOCK_POOL"
        if not self.pool:
            await self.connect()
        return await asyncio.to_thread(self.pool.get_connection)

    async def _release_connection(self, conn: Any):
        if conn == "MOCK_POOL": return
        if conn:
            await asyncio.to_thread(conn.close)

    async def read_chunked(self, table_name: str, chunk_size: int, partition_config: Optional[Dict[str, Any]] = None):
        async with self.connection() as conn:
            if conn == "MOCK_POOL": return
            cursor = conn.cursor(dictionary=True)
            try:
                quoted = ".".join([f"`{p}`" for p in table_name.split(".")])
                query = f"SELECT * FROM {quoted}"
                params = []
                if partition_config:
                    pk, start, end = partition_config.get('partition_key'), partition_config.get('range_start'), partition_config.get('range_end')
                    if pk and start is not None and end is not None:
                        query += f" WHERE `{pk}` >= %s AND `{pk}` < %s"
                        params = [start, end]
                cursor.execute(query, params)
                while True:
                    rows = cursor.fetchmany(chunk_size)
                    if not rows: break
                    yield rows
            finally:
                cursor.close()

    async def diagnose(self) -> Dict[str, Any]:
        """Perform deep diagnostics for MySQL."""
        import socket
        import time
        
        report = {
            "dns_resolution": "pending",
            "tcp_connection": "pending",
            "authentication": "pending",
            "permission_check": "pending",
            "latency_ms": 0
        }
        
        # 1. DNS Resolution
        try:
            host = self.config.get("host")
            if self._should_fail_dns():
                raise socket.gaierror(-2, "Name or service not known")
            if not self._is_mock():
                socket.gethostbyname(host)
            report["dns_resolution"] = "success"
        except Exception as e:
            report["dns_resolution"] = f"failed: {str(e)}"
            return report

        # 2. TCP Connection
        start_time = time.time()
        try:
            port = int(self.config.get("port", 3306))
            if self._should_fail_tcp():
                raise ConnectionRefusedError("Connection refused (simulated)")
            if not self._is_mock():
                s = socket.create_connection((host, port), timeout=5)
                s.close()
            report["tcp_connection"] = "success"

        except Exception as e:
            report["tcp_connection"] = f"failed: {str(e)}"
            return report

            
        try:
            success = await self.connect()
            if self._is_mock() and success:
                report["authentication"] = "success"
                report["version"] = "8.0.32 (Mock)"
                report["permission_check"] = "success"
                report["status"] = "healthy"
                report["latency_ms"] = int((time.time() - start_time) * 1000)
                return report

            if success:

                report["authentication"] = "success"
                # Check permissions
                try:
                    await self.discover_schema()
                    report["permission_check"] = "success"
                    report["status"] = "healthy"
                except Exception as e:
                    report["permission_check"] = f"restricted: {str(e)}"
                    report["status"] = "degraded"
            else:
                report["authentication"] = "failed: Credentials rejected"
                report["status"] = "failed"
        except Exception as e:
            report["authentication"] = f"failed: {str(e)}"
            report["status"] = "failed"


            
        report["latency_ms"] = int((time.time() - start_time) * 1000)
        return report

    async def discover_resources(self, target: str, **kwargs) -> List[Any]:
        async with self.connection() as conn:
            if conn == "MOCK_POOL":
                if target == "databases": return ["sys", "mysql", "AstraFlow_Repo"]
                if target == "schemas":
                    return ["public", "internal"]
                if target == "tables":
                    db = kwargs.get("database_name") or "AstraFlow_Repo"
                    return [
                        {"name": "users", "database": db, "schema": "public"},
                        {"name": "orders", "database": db, "schema": "public"},
                        {"name": "products", "database": db, "schema": "public"},
                        {"name": "discounts", "database": db, "schema": "public"},
                        {"name": "visits", "database": db, "schema": "public"}
                    ]
                return []

            cursor = conn.cursor()
            try:
                results = []
                if target == "databases":
                    cursor.execute("SHOW DATABASES")
                    results = [r[0] for r in cursor.fetchall()]
                elif target == "schemas":
                    # In MySQL, schema is synonymous with database
                    cursor.execute("SHOW DATABASES")
                    results = [r[0] for r in cursor.fetchall()]
                elif target == "tables":
                    db = kwargs.get("database_name") or self.config.get("database") or self.config.get("schema")
                    if db:
                        cursor.execute(f"SHOW TABLES FROM `{db}`")
                        results = [{"name": r[0], "database": db, "schema": "public"} for r in cursor.fetchall()]
                    else:
                        # Discover all tables in all non-system databases
                        results = []
                        cursor.execute("SHOW DATABASES")
                        dbs = [r[0] for r in cursor.fetchall()]
                        system_dbs = {'information_schema', 'mysql', 'performance_schema', 'sys'}
                        for current_db in dbs:
                            if current_db.lower() not in system_dbs:
                                cursor.execute(f"SHOW TABLES FROM `{current_db}`")
                                results.extend([{"name": r[0], "database": current_db, "schema": "public"} for r in cursor.fetchall()])
                return results
            finally:
                cursor.close()



    async def disconnect(self):
        # MySQLConnectionPool doesn't have a specific 'close all' method in basic API,
        # but we can set it to None.
        if self.pool is not None and self.pool != "MOCK_POOL":
             # If it was a real pool, we might want to close it, but the current code just sets to None.
             pass
        self.pool = None



    async def health_check(self) -> bool:
        if self.pool is None:
            return False
        conn = None
        cursor = None
        try:
            conn = self.pool.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            return result is not None and result[0] == 1
        except Exception:
            return False
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
        return False

    @runtime_monitor.trace_and_heal(component="mysql")
    async def discover_schema(self) -> List[Dict[str, Any]]:
        async with self.connection() as conn:
            if conn == "MOCK_POOL":
                return [
                    {
                        "schema": "public", 
                        "name": "users", 
                        "columns": [
                            {"name": "id", "type": "int", "nullable": False, "is_primary_key": True},
                            {"name": "email", "type": "varchar(255)", "nullable": False},
                            {"name": "created_at", "type": "timestamp", "nullable": False}
                        ],
                        "primary_key": "id",
                        "recommended_cursor": "created_at"
                    },
                    {
                        "schema": "public", 
                        "name": "orders", 
                        "columns": [
                            {"name": "id", "type": "int", "nullable": False, "is_primary_key": True},
                            {"name": "user_id", "type": "int", "nullable": False},
                            {"name": "amount", "type": "decimal(10,2)", "nullable": False},
                            {"name": "order_date", "type": "timestamp", "nullable": False}
                        ],
                        "primary_key": "id",
                        "recommended_cursor": "order_date"
                    },
                    {
                        "schema": "shop", 
                        "name": "products", 
                        "columns": [
                            {"name": "id", "type": "int", "nullable": False, "is_primary_key": True},
                            {"name": "name", "type": "varchar(100)", "nullable": False},
                            {"name": "price", "type": "decimal(10,2)", "nullable": False}
                        ],
                        "primary_key": "id"
                    }
                ]
            
            cursor = conn.cursor(dictionary=True)
            try:
                cursor.execute("""
                    SELECT 
                        TABLE_SCHEMA as schema_name,
                        TABLE_NAME as table_name,
                        COLUMN_NAME as column_name,
                        DATA_TYPE as data_type,
                        IS_NULLABLE as is_nullable,
                        COLUMN_KEY as column_key
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
                    ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
                """)

                tables: Dict[str, Any] = {}
                for row in cursor.fetchall():
                    schema_name, table_name, column_name, data_type, is_nullable, column_key = row['schema_name'], row['table_name'], row['column_name'], row['data_type'], row['is_nullable'], row['column_key']
                    key = f"{schema_name}.{table_name}"
                    if key not in tables:
                        tables[key] = {
                            "schema": schema_name,
                            "name": table_name,
                            "columns": [],
                            "primary_key": None,
                            "recommended_cursor": None
                        }
                    
                    is_pk = column_key == 'PRI'
                    tables[key]["columns"].append({
                        "name": column_name,
                        "type": data_type,
                        "nullable": is_nullable == "YES",
                        "is_primary_key": is_pk
                    })

                    if is_pk:
                        tables[key]["primary_key"] = column_name

                    # Timestamp detection heuristic for recommended cursor
                    ts_keywords = ['updated', 'modified', 'created', 'timestamp', 'time', 'date', 'at']
                    is_ts_type = any(t in data_type.lower() for t in ['timestamp', 'datetime', 'date'])
                    is_ts_name = any(k in column_name.lower() for k in ts_keywords)
                    
                    if is_ts_type or is_ts_name:
                        if not tables[key]["recommended_cursor"] or 'updated' in column_name.lower() or 'modified' in column_name.lower():
                            tables[key]["recommended_cursor"] = column_name

                return list(tables.values())
            except Exception as e:
                print(f"MySQL schema discovery error: {e}")
                return []
            finally:
                if cursor:
                    cursor.close()

    @runtime_monitor.trace_and_heal(component="mysql")
    async def read_records(self, table_name: str, sync_mode: str, cursor_val: Optional[Any] = None) -> List[Dict[str, Any]]:
        async with self.connection() as conn:
            if conn == "MOCK_POOL": return []
                
            cursor = conn.cursor(dictionary=True)
            try:
                # MySQL backticks for identifiers
                quoted = ".".join([f"`{p}`" for p in table_name.split(".")])
                query = f"SELECT * FROM {quoted}"
                params = []
                
                if sync_mode == "incremental" and cursor_val:
                    query += " WHERE `id` > %s"
                    params.append(cursor_val)
                    
                cursor.execute(query, params)
                return cursor.fetchall()
            except Exception as e:
                print(f"MySQL read error: {e}")
                return []
            finally:
                if cursor:
                    cursor.close()

    @runtime_monitor.trace_and_heal(component="mysql")
    async def write_records(self, table_name: str, records: List[Dict[str, Any]]) -> bool:
        if not records: return False
        async with self.connection() as conn:
            if conn == "MOCK_POOL": return True
            cursor = conn.cursor()
            try:
                keys = list(records[0].keys())
                quoted = ".".join([f"`{p}`" for p in table_name.split(".")])
                columns = ", ".join([f"`{k}`" for k in keys])
                placeholders = ", ".join(["%s"] * len(keys))
                query = f"INSERT INTO {quoted} ({columns}) VALUES ({placeholders})"
                cursor.executemany(query, [[r[k] for k in keys] for r in records])
                conn.commit()
                return True
            except Exception as e:
                print(f"MySQL write error: {e}")
                return False
            finally:
                if cursor:
                    cursor.close()
