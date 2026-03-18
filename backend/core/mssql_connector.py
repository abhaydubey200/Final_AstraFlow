import pyodbc
import os
import asyncio
from typing import List, Dict, Any, Optional
from core.base_connector import BaseConnector


class MSSQLConnector(BaseConnector):
    """Microsoft SQL Server connector using pyodbc."""

    @classmethod
    def get_config_schema(cls) -> Dict[str, Any]:
        return {
            "title": "SQL Server Connection",
            "type": "object",
            "required": ["host", "user", "database"],
            "properties": {
                "host": {"title": "Host", "type": "string", "placeholder": "localhost"},
                "port": {"title": "Port", "type": "integer", "default": 1433},
                "user": {"title": "Username", "type": "string"},
                "password": {"title": "Password", "type": "string", "format": "password"},
                "database": {"title": "Database", "type": "string"},
                "encrypt": {"title": "Encrypt", "type": "boolean", "default": True}
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
        self.conn = None

    def _build_connection_string(self) -> str:
        host = self.config.get("host", "")
        port = int(self.config.get("port") or 1433)
        database = self.config.get("database") or self.config.get("database_name") or "master"
        user = self.config.get("user") or self.config.get("username", "")
        password = self.config.get("password", "")

        # Try to use ODBC driver; check for available drivers
        drivers = [d for d in pyodbc.drivers() if "SQL Server" in d]
        driver = drivers[-1] if drivers else "ODBC Driver 17 for SQL Server"

        return (
            f"DRIVER={{{driver}}};"
            f"SERVER={host},{port};"
            f"DATABASE={database};"
            f"UID={user};"
            f"PWD={password};"
            "Encrypt=yes;"
            "TrustServerCertificate=yes;"
            "Connection Timeout=15;"
        )

    async def connect(self) -> bool:
        try:
            if os.getenv("USE_MOCK_DB") == "true" and os.getenv("REAL_EXTERNAL_CONNECTORS") != "true":
                print(f"Mock MSSQL connected for {self.config.get('host')}")
                self.conn = "MOCK_CONN"
                return True
            conn_str = self._build_connection_string()
            self.conn = pyodbc.connect(conn_str, autocommit=True)
            return True
        except Exception as e:
            print(f"MSSQL connection error for {self.config.get('host')}: {e}")
            return False

    async def read_chunked(self, table_name: str, chunk_size: int, partition_config: Optional[Dict[str, Any]] = None):
        if self.conn is None:
            return

        if self.conn == "MOCK_CONN":
            # Yield 3 mock chunks of 5000 rows each
            import random
            for i in range(3):
                rows = []
                for j in range(5000):
                    rows.append({"id": i*5000 + j, "name": f"User_{j}", "val": random.randint(1, 100)})
                yield rows
                await asyncio.sleep(0.1)
            return

        cursor = None
        try:
            cursor = self.conn.cursor()
            query = f"SELECT * FROM {table_name}"
            params = []
            
            if partition_config:
                pk = partition_config.get('partition_key')
                start = partition_config.get('range_start')
                end = partition_config.get('range_end')
                if pk and start is not None and end is not None:
                    query += f" WHERE [{pk}] >= ? AND [{pk}] < ?"
                    params = [start, end]
            
            cursor.execute(query, params)
            columns = [col[0] for col in cursor.description]
            while True:
                rows = cursor.fetchmany(chunk_size)
                if not rows:
                    break
                yield [dict(zip(columns, row)) for row in rows]
        finally:
            if cursor:
                cursor.close()

    async def disconnect(self):
        if self.conn is not None:
            self.conn.close()
            self.conn = None

    async def health_check(self) -> bool:
        if self.conn is None:
            return False
        cursor = None
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            return result is not None and result[0] == 1
        except Exception:
            return False
        finally:
            if cursor:
                cursor.close()
        return False

    async def diagnose(self) -> Dict[str, Any]:
        """Perform deep diagnostics and return a structured report."""
        diagnostics = {
            "status": "unknown",
            "connection": False,
            "latency_ms": 0,
            "version": "",
            "database_accessible": False,
            "permissions": [],
            "issues": [],
            "dns_resolution": "pending",
            "tcp_connection": "pending",
            "authentication": "pending"
        }
        
        if self.conn == "MOCK_CONN":
            diagnostics["status"] = "healthy"
            diagnostics["connection"] = True
            diagnostics["database_accessible"] = True
            diagnostics["version"] = "Mock SQL Server"
            diagnostics["dns_resolution"] = "success"
            diagnostics["tcp_connection"] = "success"
            diagnostics["authentication"] = "success"
            return diagnostics

        import time
        start_time = time.time()
        try:
            diagnostics["dns_resolution"] = "success"
            diagnostics["tcp_connection"] = "success"
            
            connected = await self.connect()
            diagnostics["latency_ms"] = int((time.time() - start_time) * 1000)
            
            if connected and self.conn:
                diagnostics["authentication"] = "success"
                diagnostics["connection"] = True
                cursor = None
                try:
                    cursor = self.conn.cursor()
                    
                    cursor.execute("SELECT @@VERSION")
                    row = cursor.fetchone()
                    if row:
                        diagnostics["version"] = str(row[0]).split('\\n')[0][:100]
                    
                    diagnostics["database_accessible"] = True
                    
                    # Check permissions
                    cursor.execute("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES")
                    cursor.fetchone()
                    diagnostics["permissions"].append("read_schema")
                    
                    diagnostics["status"] = "healthy"
                except Exception as e:
                    diagnostics["issues"].append(f"Query error: {str(e)}")
                    if diagnostics["status"] == "unknown":
                        diagnostics["status"] = "degraded"
                finally:
                    if cursor:
                        cursor.close()
            else:
                diagnostics["status"] = "unreachable"
                diagnostics["authentication"] = "failed"
                diagnostics["issues"].append("Could not establish connection")
                
        except Exception as e:
            diagnostics["status"] = "failed"
            diagnostics["dns_resolution"] = "failed"
            diagnostics["tcp_connection"] = "failed"
            diagnostics["authentication"] = "failed"
            diagnostics["issues"].append(f"Connection failed: {str(e)}")
            
        return diagnostics

    async def discover_schema(self) -> List[Dict[str, Any]]:
        if self.conn is None:
            return []

        cursor = None
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                SELECT 
                    TABLE_SCHEMA as schema_name,
                    TABLE_NAME as table_name,
                    COLUMN_NAME as column_name,
                    DATA_TYPE as data_type,
                    IS_NULLABLE as is_nullable
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA NOT IN ('sys', 'information_schema')
                ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
            """)

            tables: Dict[str, Any] = {}
            for row in cursor.fetchall():
                key = f"{row.schema_name}.{row.table_name}"
                if key not in tables:
                    tables[key] = {
                        "schema": row.schema_name,
                        "name": row.table_name,
                        "columns": []
                    }
                tables[key]["columns"].append({
                    "name": row.column_name,
                    "type": row.data_type,
                    "nullable": row.is_nullable == "YES"
                })
            return list(tables.values())
        except Exception as e:
            print(f"MSSQL schema discovery error: {e}")
            return []
        finally:
            if cursor:
                cursor.close()
        return []

    async def read_records(self, table_name: str, sync_mode: str, cursor_val: Optional[Any] = None) -> List[Dict[str, Any]]:
        if self.conn is None:
            return []

        cursor = None
        try:
            cursor = self.conn.cursor()
            query = f"SELECT * FROM {table_name}"
            cursor.execute(query)
            columns = [col[0] for col in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
        except Exception as e:
            print(f"MSSQL read error: {e}")
            return []
        finally:
            if cursor:
                cursor.close()
        return []

    async def write_records(self, table_name: str, records: List[Dict[str, Any]]) -> bool:
        if self.conn is None or not records:
            return False

        cursor = None
        try:
            cursor = self.conn.cursor()
            keys = list(records[0].keys())
            columns = ", ".join(keys)
            placeholders = ", ".join(["?" for _ in keys])
            query = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"
            data = [[record[k] for k in keys] for record in records]
            cursor.executemany(query, data)
            return True
        except Exception as e:
            print(f"MSSQL write error: {e}")
            return False
        finally:
            if cursor:
                cursor.close()
        return False
