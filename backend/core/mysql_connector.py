from mysql.connector.pooling import MySQLConnectionPool
from typing import List, Dict, Any, Optional
from core.base_connector import BaseConnector

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

    async def connect(self) -> bool:
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
            return True
        except Exception as e:
            print(f"MySQL connection pool error: {e}")
            return False

    async def read_chunked(self, table_name: str, chunk_size: int, partition_config: Optional[Dict[str, Any]] = None):
        if self.pool is None:
            return

        conn = None
        cursor = None
        try:
            conn = self.pool.get_connection()
            cursor = conn.cursor(dictionary=True)
            quoted_table = ".".join([f"`{p}`" for p in table_name.split(".")])
            query = f"SELECT * FROM {quoted_table}"
            params = []
            
            if partition_config:
                pk = partition_config.get('partition_key')
                start = partition_config.get('range_start')
                end = partition_config.get('range_end')
                if pk and start is not None and end is not None:
                    query += f" WHERE `{pk}` >= %s AND `{pk}` < %s"
                    params = [start, end]
            
            cursor.execute(query, params)
            while True:
                rows = cursor.fetchmany(chunk_size)
                if not rows:
                    break
                yield rows
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

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
            socket.gethostbyname(host)
            report["dns_resolution"] = "success"
        except Exception as e:
            report["dns_resolution"] = f"failed: {str(e)}"
            return report
            
        # 2. TCP Connection
        start_time = time.time()
        try:
            port = int(self.config.get("port", 3306))
            s = socket.create_connection((host, port), timeout=5)
            s.close()
            report["tcp_connection"] = "success"
        except Exception as e:
            report["tcp_connection"] = f"failed: {str(e)}"
            return report
            
        # 3. Authentication & Permission
        try:
            success = await self.connect()
            if success:
                report["authentication"] = "success"
                # Check permissions
                try:
                    await self.discover_schema()
                    report["permission_check"] = "success"
                except Exception as e:
                    report["permission_check"] = f"restricted: {str(e)}"
            else:
                report["authentication"] = "failed: Credentials rejected"
        except Exception as e:
            report["authentication"] = f"failed: {str(e)}"
            
        report["latency_ms"] = int((time.time() - start_time) * 1000)
        return report

    async def disconnect(self):
        # MySQLConnectionPool doesn't have a specific 'close all' method in basic API,
        # but we can set it to None.
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

    async def discover_schema(self) -> List[Dict[str, Any]]:
        if self.pool is None:
            return []

        conn = None
        cursor = None
        try:
            conn = self.pool.get_connection()
            cursor = conn.cursor()
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
                schema_name, table_name, column_name, data_type, is_nullable, column_key = row
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
            if conn:
                conn.close()
        return []

    async def read_records(self, table_name: str, sync_mode: str, cursor_val: Optional[Any] = None) -> List[Dict[str, Any]]:
        if self.pool is None:
            return []

        conn = None
        cursor = None
        try:
            conn = self.pool.get_connection()
            cursor = conn.cursor(dictionary=True)
            # MySQL backticks for identifiers
            quoted_table = ".".join([f"`{p}`" for p in table_name.split(".")])
            query = f"SELECT * FROM {quoted_table}"
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
            if conn:
                conn.close()

    async def write_records(self, table_name: str, records: List[Dict[str, Any]]) -> bool:
        if self.pool is None or not records:
            return False

        conn = None
        cursor = None
        try:
            conn = self.pool.get_connection()
            cursor = conn.cursor()
            keys = list(records[0].keys())
            quoted_table = ".".join([f"`{p}`" for p in table_name.split(".")])
            columns = ", ".join([f"`{k}`" for k in keys])
            placeholders = ", ".join(["%s" for _ in keys])
            query = f"INSERT INTO {quoted_table} ({columns}) VALUES ({placeholders})"
            data = [[record[k] for k in keys] for record in records]
            cursor.executemany(query, data)
            conn.commit()
            return True
        except Exception as e:
            print(f"MySQL write error: {e}")
            return False
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
