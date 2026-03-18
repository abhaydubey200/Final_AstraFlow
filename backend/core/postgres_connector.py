import asyncpg
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
        try:
            self.pool = await asyncpg.create_pool(
                host=self.config.get("host"),
                port=self.config.get("port"),
                user=self.config.get("username"),
                password=self.config.get("password"),
                database=self.config.get("database"),
                ssl='require' if self.config.get("ssl_enabled") else False
            )
            return True
        except Exception as e:
            print(f"Postgres connection error for {self.config.get('host')}: {e}")
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
        if self.pool is not None:
            await self.pool.close()
            self.pool = None
