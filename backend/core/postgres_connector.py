import asyncpg
import os
import socket

import time
from typing import List, Dict, Any, Optional
from core.base_connector import BaseConnector

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

    async def discover_schema(self) -> List[Dict[str, Any]]:
        if self.pool == "MOCK_POOL":


            return [
                {
                    "schema": "public", 
                    "name": "users", 
                    "columns": [
                        {"name": "id", "type": "uuid", "nullable": False, "is_primary_key": True},
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
                        {"name": "id", "type": "uuid", "nullable": False, "is_primary_key": True},
                        {"name": "user_id", "type": "uuid", "nullable": False},
                        {"name": "amount", "type": "numeric", "nullable": False},
                        {"name": "order_date", "type": "timestamp", "nullable": False}
                    ],
                    "primary_key": "id",
                    "recommended_cursor": "order_date"
                },
                {
                    "schema": "public", 
                    "name": "products", 
                    "columns": [
                        {"name": "id", "type": "uuid", "nullable": False, "is_primary_key": True},
                        {"name": "name", "type": "varchar(100)", "nullable": False},
                        {"name": "price", "type": "numeric", "nullable": False}
                    ],
                    "primary_key": "id"
                },
                {
                    "schema": "inventory", 
                    "name": "stocks", 
                    "columns": [
                        {"name": "sku", "type": "varchar(50)", "nullable": False, "is_primary_key": True},
                        {"name": "quantity", "type": "integer", "nullable": False}
                    ],
                    "primary_key": "sku"
                }
            ]
        if self.pool is None:

            return []

        
        query = """
        SELECT 
            c.table_schema as schema,
            c.table_name as name,
            c.column_name,
            c.data_type,
            c.is_nullable,
            (
                SELECT 1 FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                WHERE tc.constraint_type = 'PRIMARY KEY' 
                AND kcu.table_name = c.table_name 
                AND kcu.table_schema = c.table_schema
                AND kcu.column_name = c.column_name
                LIMIT 1
            ) as is_pk,
            reals.reltuples::bigint as row_count_estimate,
            pg_total_relation_size('"' || c.table_schema || '"."' || c.table_name || '"') as table_size
        FROM information_schema.columns c
        JOIN pg_class reals ON reals.relname = c.table_name
        JOIN pg_namespace ns ON ns.oid = reals.relnamespace AND ns.nspname = c.table_schema
        WHERE c.table_schema NOT IN ('information_schema', 'pg_catalog')
        ORDER BY c.table_schema, c.table_name, c.ordinal_position;
        """
        
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query)
            
        tables: Dict[str, Any] = {}
        for row in rows:
            table_key = f"{row['schema']}.{row['name']}"
            if table_key not in tables:
                tables[table_key] = {
                    "schema": row["schema"],
                    "name": row["name"],
                    "row_count_estimate": row.get("row_count_estimate", 0),
                    "table_size": row.get("table_size", 0),
                    "columns": [],
                    "primary_key": None,
                    "recommended_cursor": None
                }
            
            is_pk = row.get("is_pk") == 1
            col_name = row["column_name"]
            data_type = row["data_type"]
            
            tables[table_key]["columns"].append({
                "name": col_name,
                "type": data_type,
                "nullable": row["is_nullable"] == "YES",
                "is_primary_key": is_pk
            })
            
            if is_pk:
                tables[table_key]["primary_key"] = col_name

            # Timestamp detection heuristic for recommended cursor
            ts_keywords = ['updated', 'modified', 'created', 'timestamp', 'time', 'date', 'at']
            is_ts_type = any(t in data_type.lower() for t in ['timestamp', 'date', 'time'])
            is_ts_name = any(k in col_name.lower() for k in ts_keywords)
            
            if is_ts_type or is_ts_name:
                # Prioritize 'updated' or 'modified' for incremental syncs
                if not tables[table_key]["recommended_cursor"] or 'updated' in col_name.lower() or 'modified' in col_name.lower():
                    tables[table_key]["recommended_cursor"] = col_name
            
        return list(tables.values())

    async def read_records(self, table_name: str, sync_mode: str, cursor: Optional[Any] = None) -> List[Dict[str, Any]]:
        if self.pool is None:
            return []
            
        # Strict identifier quoting to prevent injection
        quoted_table = ".".join([f'"{p}"' for p in table_name.split(".")])
        query = f"SELECT * FROM {quoted_table}"
        params = []
        
        if sync_mode == "incremental" and cursor:
            query += " WHERE id > $1"
            params.append(cursor)
            
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(query, *params)
                return [dict(row) for row in rows]
        except Exception as e:
            print(f"Postgres read error for {table_name}: {e}")
            return []

    async def write_records(self, table_name: str, records: List[Dict[str, Any]]) -> bool:
        if self.pool is None or not records:
            return False
            
        keys = list(records[0].keys())
        # Quote columns and table
        quoted_table = ".".join([f'"{p}"' for p in table_name.split(".")])
        columns = ", ".join([f'"{k}"' for k in keys])
        placeholders = ", ".join([f"${i+1}" for i in range(len(keys))])
        query = f"INSERT INTO {quoted_table} ({columns}) VALUES ({placeholders})"
        
        try:
            async with self.pool.acquire() as conn:
                async with conn.transaction():
                    # For performance and safety, use executemany
                    data = [[record[k] for k in keys] for record in records]
                    await conn.executemany(query, data)
            return True
        except Exception as e:
            print(f"Postgres write error for {table_name}: {e}")
            return False

    async def read_chunked(self, table_name: str, chunk_size: int, partition_config: Optional[Dict[str, Any]] = None):
        if self.pool is None:
            return
            
        quoted_table = ".".join([f'"{p}"' for p in table_name.split(".")])
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                query = f"SELECT * FROM {quoted_table}"
                params = []
                if partition_config:
                    pk = partition_config.get('partition_key')
                    start = partition_config.get('range_start')
                    end = partition_config.get('range_end')
                    if pk and start is not None and end is not None:
                        # Quote partition key
                        query += f" WHERE \"{pk}\" >= $1 AND \"{pk}\" < $2"
                        params = [start, end]
                
                # Use a server-side cursor for large datasets
                cur = await conn.cursor(query, *params)
                while True:
                    rows = await cur.fetch(chunk_size)
                    if not rows:
                        break
                    yield [dict(row) for row in rows]

    async def diagnose(self) -> Dict[str, Any]:
        """Perform deep diagnostics for PostgreSQL."""
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
            host = self.config.get("host")
            port = self.config.get("port")
            if self._should_fail_tcp():
                raise ConnectionRefusedError("Connection refused (simulated)")
            if not self._is_mock():
                s = socket.create_connection((host, port), timeout=5)
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
                report["version"] = "PostgreSQL 15 (Mock)"
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
        """Discover PostgreSQL resources like databases, schemas, or tables with optional context."""
        database_context = kwargs.get("database_name")

        if self.pool == "MOCK_POOL":
            if target == "databases":
                return ["postgres", "test_db", "customer_data", "analytics_db", "staging_db"]
            if target == "schemas":
                return ["public", "internal", "audit", "inventory"]
            if target == "tables":
                db = database_context or "customer_data"
                return [
                    {"name": "users", "database": db, "schema": "public"},
                    {"name": "orders", "database": db, "schema": "public"},
                    {"name": "products", "database": db, "schema": "public"},
                    {"name": "stocks", "database": db, "schema": "internal"},
                    {"name": "shipments", "database": db, "schema": "internal"},
                    {"name": "logs", "database": db, "schema": "audit"}
                ]
            return []

        if self.pool is None:
            return []

        async with self.pool.acquire() as conn:
            if target == "databases":
                rows = await conn.fetch("SELECT datname FROM pg_database WHERE datistemplate = false")
                return [r['datname'] for r in rows]
            elif target == "schemas":
                rows = await conn.fetch("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog')")
                return [r['schema_name'] for r in rows]
            elif target == "tables":
                current_db = database_context or self.config.get("database")
                # To discover tables in a specific database in Postgres, we usually need to be connected to it.
                # For discovery purposes, we return tables from the current connection's perspective.
                rows = await conn.fetch("SELECT table_name, table_schema FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog')")
                return [{"name": r['table_name'], "database": current_db, "schema": r['table_schema']} for r in rows]
            return []



    async def disconnect(self):
        if self.pool is not None and self.pool != "MOCK_POOL":
            await self.pool.close()
        self.pool = None


