import snowflake.connector
import os
import socket

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
        """Establish connection to Snowflake. Only uses mock if host is explicitly a mock pattern."""
        host = (self.config.get("host") or "").lower()

        # Only use Mock if explicitly requested via host name
        if "mock" in host or "demo" in host:
            print(f"Using Mock Snowflake connection for {host}")
            self.conn = "MOCK_CONN"
            return True

        # Try real connection
        try:
            self.conn = await asyncio.wait_for(
                asyncio.to_thread(
                    snowflake.connector.connect,
                    user=self.config.get("user") or self.config.get("username"),
                    password=self.config.get("password"),
                    account=self.config.get("host") or self.config.get("account"),
                    port=self.config.get("port", 443),
                    warehouse=self.config.get("warehouse", self.config.get("database")),
                    database=self.config.get("database") or self.config.get("database_name"),
                    role=self.config.get("role", "PUBLIC"),
                    schema=self.config.get("schema", "PUBLIC")
                ),
                timeout=20  # Snowflake can be slow
            )
            print(f"Successfully connected to real Snowflake instance at {host}")
            return True
        except Exception as e:
            # No silent fallback to mock for real accounts
            print(f"Snowflake connection error for {host}: {e}")
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
            host = account if ".snowflakecomputing.com" in account else f"{account}.snowflakecomputing.com"
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
            port = self.config.get("port", 443)
            if self._should_fail_tcp():
                raise ConnectionRefusedError("Connection refused (simulated)")
            if not self._is_mock():
                s = socket.create_connection((host, int(port)), timeout=5)
                s.close()
            report["tcp_connection"] = "success"


        except Exception as e:
            report["tcp_connection"] = f"failed: {str(e)}"
            return report
            
        # 3. Authentication & Permission
        try:
            success = await self.connect()
            if self._is_mock() and success:
                report["authentication"] = "success"
                report["version"] = "Snowflake 7.21 (Mock)"
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


    async def disconnect(self):
        if self.conn is not None:
            try:
                if self.conn != "MOCK_CONN":
                    self.conn.close()
            except:
                pass
            self.conn = None

    async def discover_resources(self, target: str, **kwargs) -> List[Any]:
        """Discover Snowflake resources like warehouses, databases, schemas, or tables with optional context."""
        database_context = kwargs.get("database_name")

        if self.conn == "MOCK_CONN":
            if target == "warehouses":
                return ["COMPUTE_WH", "DEMO_WH", "ANALYTICS_WH"]
            if target == "databases":
                return ["DS_GROUP_HR_DB", "SNOWFLAKE_SAMPLE_DATA", "UTIL_DB", "SALES_ANALYTICS"]
            if target == "schemas":
                return ["PUBLIC", "INFORMATION_SCHEMA", "STAGING", "RAW"]
            if target == "tables":
                db = database_context or "DS_GROUP_HR_DB"
                return [
                    {"name": "USERS", "database": db, "schema": "PUBLIC"},
                    {"name": "ORDERS", "database": db, "schema": "PUBLIC"},
                    {"name": "PRODUCTS", "database": db, "schema": "PUBLIC"},
                    {"name": "INVENTORY", "database": db, "schema": "PUBLIC"},
                    {"name": "SALES_DAILY", "database": db, "schema": "ANALYTICS"},
                    {"name": "MARKETING_LEADS", "database": db, "schema": "MARKETING"}
                ]
            return []

        if self.conn is None:
            return []

        cursor = self.conn.cursor()
        try:
            results = []
            if target == "warehouses":
                cursor.execute("SHOW WAREHOUSES")
                results = [r[0] for r in cursor.fetchall()]
            elif target == "databases":
                cursor.execute("SHOW DATABASES")
                results = [r[1] for r in cursor.fetchall()]
            elif target == "schemas":
                db = database_context or self.config.get("database")
                if db:
                    cursor.execute(f'SHOW SCHEMAS IN DATABASE "{db}"')
                    results = [r[1] for r in cursor.fetchall()]
            elif target == "tables":
                db = database_context or self.config.get("database")
                if db:
                    # Discover all tables in database if schema not specified
                    cursor.execute(f'SHOW TABLES IN DATABASE "{db}"')
                    # Snowflake SHOW TABLES IN DATABASE returns database_name at index 2 and schema_name at index 3
                    # (Standard snowflake-connector-python indexes)
                    results = [{"name": r[1], "database": r[2], "schema": r[3]} for r in cursor.fetchall()]
            return results
        finally:
            cursor.close()



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
        if self.conn == "MOCK_CONN":
            return [
                {
                    "schema": "PUBLIC", 
                    "name": "USERS", 
                    "columns": [
                        {"name": "ID", "type": "NUMBER", "nullable": False, "is_primary_key": True},
                        {"name": "EMAIL", "type": "TEXT", "nullable": False},
                        {"name": "CREATED_AT", "type": "TIMESTAMP_NTZ", "nullable": False}
                    ],
                    "primary_key": "ID",
                    "recommended_cursor": "CREATED_AT"
                },
                {
                    "schema": "PUBLIC", 
                    "name": "ORDERS", 
                    "columns": [
                        {"name": "ID", "type": "NUMBER", "nullable": False, "is_primary_key": True},
                        {"name": "USER_ID", "type": "NUMBER", "nullable": False},
                        {"name": "TOTAL", "type": "NUMBER", "nullable": False},
                        {"name": "ORDER_DATE", "type": "TIMESTAMP_NTZ", "nullable": False}
                    ],
                    "primary_key": "ID",
                    "recommended_cursor": "ORDER_DATE"
                },
                {
                    "schema": "PUBLIC", 
                    "name": "PRODUCTS", 
                    "columns": [
                        {"name": "ID", "type": "NUMBER", "nullable": False, "is_primary_key": True},
                        {"name": "NAME", "type": "TEXT", "nullable": False},
                        {"name": "PRICE", "type": "NUMBER", "nullable": False}
                    ],
                    "primary_key": "ID"
                },
                {
                    "schema": "RAW", 
                    "name": "INVENTORY", 
                    "columns": [
                        {"name": "SKU", "type": "TEXT", "nullable": False, "is_primary_key": True},
                        {"name": "QUANTITY", "type": "NUMBER", "nullable": False}
                    ],
                    "primary_key": "SKU"
                },
                {
                    "schema": "ANALYTICS", 
                    "name": "SALES_DAILY", 
                    "columns": [
                        {"name": "DATE", "type": "DATE", "nullable": False},
                        {"name": "REVENUE", "type": "NUMBER", "nullable": False}
                    ],
                    "recommended_cursor": "DATE"
                }
            ]
        if self.conn is None:
            return []
        
        cursor = None
        col_cursor = None
        try:
            cursor = self.conn.cursor()
            db_name = self.config.get("database") or self.config.get("database_name")
            
            # Show all tables and views in the entire database
            cursor.execute(f'SHOW TABLES IN DATABASE "{db_name}"')
            rows = cursor.fetchall()
            
            # and views
            try:
                cursor.execute(f'SHOW VIEWS IN DATABASE "{db_name}"')
                rows.extend(cursor.fetchall())
            except Exception as e:
                print(f"Non-critical: Could not fetch views for Snowflake: {e}")
            
            tables = []
            for row in rows:
                # Snowflake indices for SHOW TABLES/VIEWS: 1:name, 2:schema_name
                table_name = row[1]
                schema_name = row[2]
                
                # Skip internal schemas
                if schema_name.upper() in ['INFORMATION_SCHEMA']:
                    continue

                
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

