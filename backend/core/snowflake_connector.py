import snowflake.connector
import os
import asyncio
from typing import List, Dict, Any, Optional
from core.base_connector import BaseConnector

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

    async def connect(self) -> bool:
        """Establish connection to Snowflake."""
        try:
            if os.getenv("USE_MOCK_DB") == "true" and os.getenv("REAL_EXTERNAL_CONNECTORS") != "true":
                print(f"Mock Snowflake connected")
                self.conn = "MOCK_CONN"
                return True
            
            # Non-blocking connection if possible, or run in thread
            self.conn = await asyncio.to_thread(
                snowflake.connector.connect,
                user=self.config.get("user") or self.config.get("username"),
                password=self.config.get("password"),
                account=self.config.get("host") or self.config.get("account"),
                port=self.config.get("port", 443),
                warehouse=self.config.get("warehouse", self.config.get("database")),
                database=self.config.get("database") or self.config.get("database_name"),
                role=self.config.get("role", "PUBLIC"),
                schema=self.config.get("schema", "PUBLIC")
            )
            return True
        except Exception as e:
            print(f"Snowflake connection error: {e}")
            return False

    async def diagnose(self) -> Dict[str, Any]:
        """Perform deep diagnostics for Snowflake."""
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
            account = self.config.get("host", "")
            # Snowflake "host" is often the account identifier, need to check if it's a full URL
            host = account if ".snowflakecomputing.com" in account else f"{account}.snowflakecomputing.com"
            socket.gethostbyname(host)
            report["dns_resolution"] = "success"
        except Exception as e:
            report["dns_resolution"] = f"failed: {str(e)}"
            return report
            
        # 2. TCP Connection
        start_time = time.time()
        try:
            port = self.config.get("port", 443)
            s = socket.create_connection((host, int(port)), timeout=5)
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
                try:
                    # Use the resource discovery logic
                    await self.discover_resources({"target": "warehouses"})
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
        if self.conn is not None:
            try:
                self.conn.close()
            except:
                pass
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

    async def discover_schema(self) -> List[Dict[str, Any]]:
        if self.conn is None:
            return []
        
        cursor = None
        col_cursor = None
        try:
            cursor = self.conn.cursor()
            cursor.execute("SHOW TABLES")
            rows = cursor.fetchall()
            
            tables = []
            for row in rows:
                schema_name = row[2]
                table_name = row[1]
                
                col_cursor = self.conn.cursor()
                col_cursor.execute(f'DESC TABLE "{schema_name}"."{table_name}"')
                col_rows = col_cursor.fetchall()
                
                columns = []
                primary_key = None
                recommended_cursor = None
                
                for col in col_rows:
                    # Snowflake DESC TABLE indices: 0:name, 1:type, 3:null?, 5:primary key
                    col_name = col[0]
                    col_type = col[1]
                    is_pk = col[5] == 'Y'
                    is_nullable = col[3] == 'Y'
                    
                    columns.append({
                        "name": col_name,
                        "type": col_type,
                        "nullable": is_nullable,
                        "is_primary_key": is_pk
                    })
                    
                    if is_pk:
                        primary_key = col_name
                        
                    # Timestamp detection heuristic
                    ts_keywords = ['updated', 'modified', 'created', 'timestamp', 'time', 'date', 'at']
                    is_ts_type = any(t in col_type.lower() for t in ['timestamp', 'date', 'time'])
                    is_ts_name = any(k in col_name.lower() for k in ts_keywords)
                    
                    if is_ts_type or is_ts_name:
                        if not recommended_cursor or 'updated' in col_name.lower() or 'modified' in col_name.lower():
                            recommended_cursor = col_name

                tables.append({
                    "schema": schema_name,
                    "name": table_name,
                    "columns": columns,
                    "primary_key": primary_key,
                    "recommended_cursor": recommended_cursor
                })
                col_cursor.close()
                col_cursor = None
                
            return tables
        except Exception as e:
            print(f"Schema discovery error: {e}")
            return []
        finally:
            if cursor:
                cursor.close()
            if col_cursor:
                col_cursor.close()
        return []

    async def read_records(self, table_name: str, sync_mode: str, cursor: Optional[Any] = None) -> List[Dict[str, Any]]:
        if self.conn is None:
            return []
        
        cursor_obj = None
        try:
            cursor_obj = self.conn.cursor()
            # Snowflake uses double quotes for identifiers
            quoted_table = ".".join([f'"{p}"' for p in table_name.split(".")])
            query = f"SELECT * FROM {quoted_table}"
            params = []
            
            if sync_mode == "incremental" and cursor:
                query += ' WHERE "id" > %s'
                params.append(cursor)
                
            cursor_obj.execute(query, params)
            columns = [col[0] for col in cursor_obj.description]
            return [dict(zip(columns, row)) for row in cursor_obj.fetchall()]
        except Exception as e:
            print(f"Snowflake read error for {table_name}: {e}")
            return []
        finally:
            if cursor_obj:
                cursor_obj.close()
        return []

    async def read_chunked(self, table_name: str, chunk_size: int, partition_config: Optional[Dict[str, Any]] = None):
        if self.conn is None:
            return

        if self.conn == "MOCK_CONN":
            # Just return immediately for load simulation, or yield if used for read
            return

        cursor = None
        try:
            cursor = self.conn.cursor()
            quoted_table = ".".join([f'"{p}"' for p in table_name.split(".")])
            query = f"SELECT * FROM {quoted_table}"
            params = []
            
            if partition_config:
                pk = partition_config.get('partition_key')
                start = partition_config.get('range_start')
                end = partition_config.get('range_end')
                if pk and start is not None and end is not None:
                    query += f' WHERE "{pk}" >= %s AND "{pk}" < %s'
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

    async def write_records(self, table_name: str, records: List[Dict[str, Any]]) -> bool:
        if self.conn is None or not records:
            return False
            
        cursor_obj = None
        try:
            cursor_obj = self.conn.cursor()
            keys = list(records[0].keys())
            quoted_table = ".".join([f'"{p}"' for p in table_name.split(".")])
            columns = ", ".join([f'"{k}"' for k in keys])
            placeholders = ", ".join(["%s"] * len(keys))
            query = f"INSERT INTO {quoted_table} ({columns}) VALUES ({placeholders})"
            
            data = [[record[k] for k in keys] for record in records]
            cursor_obj.executemany(query, data)
            return True
        except Exception as e:
            print(f"Snowflake write error for {table_name}: {e}")
            return False
        finally:
            if cursor_obj:
                cursor_obj.close()
        return False

