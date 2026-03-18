import os
import uuid
import json
import asyncpg
import time
import asyncio
from fastapi import HTTPException
from typing import List, Dict, Any, Optional
from core.base_connector import BaseConnector
from core.connector_registry import ConnectorRegistry
from services.metadata_service import MetadataService
from services.secret_service import SecretService
from services.capability_service import CapabilityService
from services.ai_service import AIService

class ConnectionService:
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool
        self.metadata_service = MetadataService(pool)
        self.secret_service = SecretService(pool)
        self.capability_service = CapabilityService(pool)
        self.ai_service = AIService()
        self._pool_cache = {} 

    async def list_connections(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        async with self.pool.acquire() as conn:
            # Join with performance and capabilities
            rows = await conn.fetch("""
                SELECT c.*, cp.avg_latency_ms, cap.supports_cdc, cap.supports_incremental
                FROM connections c
                LEFT JOIN connection_performance cp ON c.id = cp.connection_id
                LEFT JOIN connection_capabilities cap ON c.id = cap.connection_id
                ORDER BY c.created_at DESC
                LIMIT $1 OFFSET $2
            """, limit, offset)
            return [dict(r) for r in rows]

    async def get_connection(self, connection_id: str) -> Optional[Dict[str, Any]]:
        try:
            p_uuid = uuid.UUID(connection_id)
        except (ValueError, TypeError):
            return None

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT c.*, cp.avg_latency_ms, cp.avg_query_time_ms, cp.requests_per_minute, cp.error_rate,
                       cc.supports_cdc, cc.supports_incremental, cc.supports_parallel_reads, cc.supports_transactions, cc.max_connections
                FROM connections c
                LEFT JOIN connection_performance cp ON c.id = cp.connection_id
                LEFT JOIN connection_capabilities cc ON c.id = cc.connection_id
                WHERE c.id = $1
            """, p_uuid)
            return dict(row) if row else None

    async def delete_connection(self, connection_id: str):
        async with self.pool.acquire() as conn:
            await conn.execute("DELETE FROM connections WHERE id = $1", uuid.UUID(connection_id))
        
        # Cleanup cached pool if it exists
        if connection_id in self._pool_cache:
            try:
                old_pool = self._pool_cache.pop(connection_id)
                await old_pool.close()
            except Exception:
                pass

    async def create_connection(self, config: Dict[str, Any]):
        async with self.pool.acquire() as conn:
            port = config.get("port")
            if not port:
                try:
                    connector_class = ConnectorRegistry.get_connector_class(config.get("type"))
                    schema = connector_class.get_config_schema()
                    port = schema.get("properties", {}).get("port", {}).get("default", 0)
                except Exception:
                    port = 0
            
            conn_id = await conn.fetchval(
                "INSERT INTO connections (name, type, host, port, database_name, username, ssl_enabled, security_level) "
                "VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
                config.get("name"), config.get("type"), config.get("host"), port,
                config.get("database_name") or config.get("database"), 
                config.get("username") or config.get("user"),
                config.get("ssl_enabled", False),
                config.get("security_level", "standard")
            )
            
            # Use SecretService for credentials
            if config.get("password"):
                await self.secret_service.store_secret(str(conn_id), 'password', config.get("password"))
                
            # Initial capability detection
            await self.capability_service.detect_capabilities({**config, "connection_id": str(conn_id)})
            
            # Persist Sync Configs
            selected_tables = config.get("selected_tables", [])
            sync_configs = config.get("sync_configs", {})
            
            for table_meta in selected_tables:
                table_name = table_meta.get("name") if isinstance(table_meta, dict) else table_meta
                schema_name = table_meta.get("schema", "public") if isinstance(table_meta, dict) else "public"
                
                table_sync = sync_configs.get(table_name, {})
                
                await conn.execute("""
                    INSERT INTO sync_configs (connection_id, table_name, schema_name, sync_mode, cursor_field, primary_key, selected_columns)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                """, 
                conn_id, table_name, schema_name,
                table_sync.get("mode", "full_refresh"),
                table_sync.get("cursorField"),
                table_sync.get("primaryKey"),
                json.dumps(table_sync.get("columns", []))
                )
                
            return {"id": str(conn_id), "status": "created"}
            
    async def update_connection(self, connection_id: str, config: Dict[str, Any]):
        async with self.pool.acquire() as conn:
            p_uuid = uuid.UUID(connection_id)
            port = config.get("port")
            if not port:
                port = {"postgresql": 5432, "snowflake": 443, "mysql": 3306, "mssql": 1433}.get(config.get("type"), 0)
            
            await conn.execute("""
                UPDATE connections 
                SET name = $1, host = $2, port = $3, database_name = $4, username = $5, ssl_enabled = $6, security_level = $7
                WHERE id = $8
            """, 
            config.get("name"), config.get("host"), port,
            config.get("database_name") or config.get("database"), 
            config.get("username") or config.get("user"),
            config.get("ssl_enabled", False),
            config.get("security_level", "standard"),
            p_uuid)
            
            # Update password if provided
            if config.get("password"):
                await self.secret_service.store_secret(connection_id, 'password', config.get("password"))
            
            # Invalidate cached pool
            if connection_id in self._pool_cache:
                try:
                    old_pool = self._pool_cache.pop(connection_id)
                    await old_pool.close()
                except Exception:
                    pass
                    
            return {"id": connection_id, "status": "updated"}

    async def get_secrets(self, connection_id: str) -> Dict[str, Any]:
        """Fetches secrets via SecretService."""
        password = await self.secret_service.get_secret(connection_id, 'password')
        return {"password": password} if password else {}

    async def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test a connection and return a detailed diagnostic report."""
        connector_type = config.get("type", "postgresql")
        
        # Resolve password if connection_id provided (for editing existing connections)
        password = config.get("password")
        connection_id = config.get("id") or config.get("connection_id")
        if not password and connection_id:
            password = await self.secret_service.get_secret(connection_id, "password")

        normalized_config = {
            "host": config.get("host"),
            "port": int(config.get("port") or 0),
            "database": config.get("database_name") or config.get("database"),
            "database_name": config.get("database_name") or config.get("database"),
            "user": config.get("username") or config.get("user"),
            "username": config.get("username") or config.get("user"),
            "password": password,
            "ssl_enabled": config.get("ssl_enabled", False),
            "ssl": config.get("ssl_enabled", False),
            "warehouse": config.get("warehouse_name") or config.get("warehouse"),
        }

        try:
            connector_class = ConnectorRegistry.get_connector_class(connector_type)
            connector = connector_class(normalized_config)
            
            # Perform deep diagnostics
            report = await connector.diagnose()
            
            # Classification: Success requires basic connectivity and auth
            success = (report.get("dns_resolution") == "success" and 
                       report.get("tcp_connection") == "success" and 
                       report.get("authentication") == "success")
            
            if success and connection_id:
                await self._update_performance(connection_id, report.get("latency_ms", 0))
            
            if not success:
               ai_suggestion = await self.ai_service.explain_failure(next((v for k, v in report.items() if isinstance(v, str) and "failed" in v), str(report)))
               report["ai_suggestion"] = ai_suggestion

            return {
                "success": success,
                "latency_ms": report.get("latency_ms", 0),
                "message": "Connection verified" if success else "Diagnostic failure identified",
                "diagnostics": report,
                "error": next((v for k, v in report.items() if isinstance(v, str) and "failed" in v), None),
                "suggestion": report.get("ai_suggestion", {}).get("fix")
            }
        except Exception as e:
            return {
                "success": False,
                "latency_ms": 0,
                "message": f"Critical error: {str(e)}",
                "error": str(e)
            }
        finally:
            if 'connector' in locals() and connector:
                try: await connector.disconnect()
                except: pass

    async def _run_connector_test(self, connector: BaseConnector, start_time: float) -> Dict[str, Any]:
        """Internal helper to run connection + health check."""
        try:
            if await connector.connect():
                latency = int((time.time() - start_time) * 1000)
                is_healthy = await connector.health_check()
                await connector.disconnect()
                return {"success": is_healthy, "latency": latency}
            return {"success": False, "error": "Could not establish connection"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _update_performance(self, connection_id: str, latency: int):
        async with self.pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO connection_performance (connection_id, avg_latency_ms, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (connection_id) DO UPDATE SET
                avg_latency_ms = (connection_performance.avg_latency_ms + EXCLUDED.avg_latency_ms) / 2,
                updated_at = NOW()
            """, uuid.UUID(connection_id), float(latency))

    async def get_schema(self, config: Dict[str, Any]) -> Dict[str, Any]:
        connector_type = config.get("type") or config.get("connector_type")
        connection_id = config.get("connection_id") or config.get("id")
        
        # --- Mock Bypass ---
        if os.getenv("USE_MOCK_DB") == "true" and os.getenv("REAL_EXTERNAL_CONNECTORS") != "true":
            print(f"DEBUG: Mock schema discovery for {connector_type}")
            tables_data = [
                {
                    "schema": "public", 
                    "name": "users", 
                    "primary_key": "id",
                    "recommended_cursor": "updated_at",
                    "columns": [
                        {"name": "id", "type": "uuid", "nullable": False, "is_primary_key": True}, 
                        {"name": "email", "type": "string", "nullable": False},
                        {"name": "updated_at", "type": "timestamp", "nullable": False}
                    ]
                },
                {
                    "schema": "public", 
                    "name": "orders", 
                    "primary_key": "id",
                    "columns": [
                        {"name": "id", "type": "uuid", "nullable": False, "is_primary_key": True}, 
                        {"name": "amount", "type": "decimal", "nullable": True}
                    ]
                }
            ]
            # Apply recommendation logic to mock data too
            for table in tables_data:
                table["recommendation"] = {
                    "mode": "cdc" if table.get("primary_key") else "incremental",
                    "reason": "Primary key identified" if table.get("primary_key") else "No PK; falling back to incremental"
                }
            return {"tables": tables_data, "supported": True, "count": len(tables_data), "cached": False}

        # Check cache first
        if connection_id and not config.get("force_refresh"):
            cached = await self.metadata_service.get_cached_schema(connection_id)
            if cached:
                return {"tables": cached, "supported": True, "count": len(cached), "cached": True}

        # Resolve password
        password = config.get("password")
        if not password and connection_id:
            password = await self.secret_service.get_secret(connection_id, "password")

        normalized_config = {
            "host": config.get("host"),
            "port": int(config.get("port") or 0),
            "database": config.get("database_name") or config.get("database"),
            "database_name": config.get("database_name") or config.get("database"),
            "user": config.get("username") or config.get("user"),
            "username": config.get("username") or config.get("user"),
            "password": password,
            "ssl_enabled": config.get("ssl_enabled", False),
            "ssl": config.get("ssl_enabled", False)
        }
        
        try:
            connector_class = ConnectorRegistry.get_connector_class(connector_type)
            connector = connector_class(normalized_config)
            
            tables_data = await asyncio.wait_for(
                self._run_schema_discovery(connector), 
                timeout=30.0
            )

            # --- Intelligent Recommendation ---
            capabilities = connector.get_capabilities()
            resolved_tables = tables_data or []
            for table in resolved_tables:
                rec_mode = "full_refresh"
                reason = "No primary key or reliable cursor found"
                
                if capabilities.get("supports_cdc") and table.get("primary_key"):
                    rec_mode = "cdc"
                    reason = f"Highly efficient; Primary key '{table['primary_key']}' identified"
                elif table.get("recommended_cursor"):
                    rec_mode = "incremental"
                    reason = f"Incremental possible via cursor '{table['recommended_cursor']}'"
                
                table["recommendation"] = {
                    "mode": rec_mode,
                    "reason": reason
                }
            
            if tables_data is not None:
                if connection_id:
                    await self.metadata_service.save_schema(str(connection_id), tables_data)
                return {"tables": tables_data, "supported": True, "count": len(tables_data), "cached": False}
            return {"tables": [], "supported": False, "message": "Could not connect to service"}
        except asyncio.TimeoutError:
            return {"tables": [], "supported": False, "message": "Schema discovery timed out after 30 seconds"}
        except ValueError as e:
            return {"tables": [], "supported": False, "message": str(e)}
        except Exception as e:
            return {"tables": [], "supported": False, "message": f"Discovery error: {str(e)}"}

    async def _run_schema_discovery(self, connector: BaseConnector) -> Optional[List[Dict[str, Any]]]:
        """Internal helper for schema discovery."""
        try:
            if await connector.connect():
                tables = await connector.discover_schema()
                await connector.disconnect()
                return tables
            return None
        except Exception:
            return None

    async def discover_resources(self, config: Dict[str, Any]) -> Dict[str, Any]:
        connector_type = (config.get("type") or config.get("connector_type") or "").lower()
        target = config.get("target", "databases")
        
        # --- Mock Bypass for Session Persistence and Demo Stability ---
        if os.getenv("USE_MOCK_DB") == "true" and os.getenv("REAL_EXTERNAL_CONNECTORS") != "true":
            print(f"DEBUG: Mock discovery for {connector_type} target {target}")
            if target == "warehouses":
                return {"results": ["COMPUTE_WH", "DEMO_WH", "ANALYTICS_WH"]}
            if target == "databases":
                if connector_type == "snowflake":
                    return {"results": ["DS_GROUP_HR_DB", "SNOWFLAKE_SAMPLE_DATA", "UTIL_DB"]}
                if connector_type == "postgresql":
                    return {"results": ["postgres", "main_db", "test_db"]}
                return {"results": ["demo_db", "test_db"]}
            if target == "schemas":
                if connector_type == "snowflake":
                    return {"results": ["PUBLIC", "INFORMATION_SCHEMA", "STAGING"]}
                return {"results": ["public", "internal"]}
            if target == "tables":
                # Mock tables with recommendations for Step 7
                tables_data = [
                    {
                        "schema": "public", 
                        "name": "users", 
                        "primary_key": "id",
                        "recommended_cursor": "updated_at",
                        "columns": [
                            {"name": "id", "type": "INTEGER", "primary_key": True},
                            {"name": "name", "type": "VARCHAR"},
                            {"name": "email", "type": "VARCHAR"},
                            {"name": "updated_at", "type": "TIMESTAMP"},
                            {"name": "created_at", "type": "TIMESTAMP"}
                        ]
                    },
                    {
                        "schema": "public", 
                        "name": "orders", 
                        "primary_key": "id",
                        "columns": [
                            {"name": "id", "type": "INTEGER", "primary_key": True},
                            {"name": "user_id", "type": "INTEGER"},
                            {"name": "amount", "type": "DECIMAL"},
                            {"name": "status", "type": "VARCHAR"},
                            {"name": "order_date", "type": "TIMESTAMP"}
                        ]
                    }
                ]
                for table in tables_data:
                    table["recommendation"] = {
                        "mode": "cdc" if table.get("primary_key") else "incremental",
                        "reason": "Primary key identified" if table.get("primary_key") else "No PK; falling back to incremental"
                    }
                return {"results": tables_data}
            return {"results": []}

        # Normalize config
        connection_id = config.get("connection_id") or config.get("id")
        password = config.get("password")
        if not password and connection_id:
            password = await self.secret_service.get_secret(connection_id, "password")

        normalized_config = {
            "host": config.get("host"),
            "port": int(config.get("port") or 0),
            "database": config.get("database_name") or config.get("database"),
            "database_name": config.get("database_name") or config.get("database"),
            "user": config.get("username") or config.get("user"),
            "username": config.get("username") or config.get("user"),
            "password": password,
            "ssl_enabled": config.get("ssl_enabled", False),
            "ssl": config.get("ssl_enabled", False),
            "warehouse": config.get("warehouse_name") or config.get("warehouse"),
            "warehouse_name": config.get("warehouse_name") or config.get("warehouse"),
            "schema": config.get("schema_name") or config.get("schema"),
            "schema_name": config.get("schema_name") or config.get("schema")
        }

        results = []
        connector = None

        try:
            connector_class = ConnectorRegistry.get_connector_class(connector_type)
            # Snowflake and others might need specialized logic for these targets,
            # but for Phase 1 we'll keep the specialized logic here but use the registry for class instantiation.
            # We will move this logic into connectors in Phase 9.
            connector = connector_class(normalized_config)
            
            if await connector.connect():
                if connector_type == "postgresql":
                    async with connector.pool.acquire() as conn:
                        if target == "databases":
                            rows = await conn.fetch("SELECT datname FROM pg_database WHERE datistemplate = false")
                            results = [r['datname'] for r in rows]
                        elif target == "schemas":
                            rows = await conn.fetch("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog')")
                            results = [r['schema_name'] for r in rows]
                        elif target == "tables":
                            schema = config.get("schema_name") or "public"
                            rows = await conn.fetch("SELECT table_name FROM information_schema.tables WHERE table_schema = $1", schema)
                            results = [r['table_name'] for r in rows]

                elif connector_type == "mysql":
                    cursor = connector.pool.get_connection().cursor()
                    if target == "databases":
                        cursor.execute("SHOW DATABASES")
                        all_dbs = [r[0] for r in cursor.fetchall()]
                        system_dbs = {'information_schema', 'mysql', 'performance_schema', 'sys'}
                        results = [db for db in all_dbs if db.lower() not in system_dbs]
                        if not results: results = all_dbs
                    elif target == "schemas":
                        db = config.get("database_name") or config.get("database")
                        results = [db] if db else []
                    elif target == "tables":
                        db = config.get("schema_name") or config.get("database_name") or config.get("database")
                        if db:
                            # Use backticks for MySQL identifiers
                            clean_db = db.replace("`", "``")
                            cursor.execute(f"SHOW TABLES FROM `{clean_db}`")
                            results = [r[0] for r in cursor.fetchall()]
                    cursor.close()

                elif connector_type in ("mssql", "sqlserver"):
                    cursor = connector.conn.cursor()
                    if target == "databases":
                        cursor.execute("SELECT name FROM sys.databases WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')")
                        results = [r[0] for r in cursor.fetchall()]
                    elif target == "schemas":
                        cursor.execute("SELECT name FROM sys.schemas WHERE name NOT IN ('sys', 'information_schema')")
                        results = [r[0] for r in cursor.fetchall()]
                    elif target == "tables":
                        schema = config.get("schema_name") or "dbo"
                        cursor.execute("SELECT name FROM sys.tables WHERE schema_name(schema_id) = ?", schema)
                        results = [r[0] for r in cursor.fetchall()]
                    cursor.close()

                elif connector_type == "snowflake":
                    cursor = connector.conn.cursor()
                    if target == "warehouses":
                        cursor.execute("SHOW WAREHOUSES")
                        results = [r[0] for r in cursor.fetchall()]
                    elif target == "databases":
                        cursor.execute("SHOW DATABASES")
                        results = [r[1] for r in cursor.fetchall()]
                    elif target == "schemas":
                        db = config.get("database_name") or config.get("database")
                        if db:
                            cursor.execute(f'SHOW SCHEMAS IN DATABASE "{db}"')
                            results = [r[1] for r in cursor.fetchall()]
                    elif target == "tables":
                        db = config.get("database_name") or config.get("database")
                        schema = config.get("schema_name") or config.get("schema")
                        if db and schema:
                            cursor.execute(f'SHOW TABLES IN SCHEMA "{db}"."{schema}"')
                            results = [r[1] for r in cursor.fetchall()]
                    cursor.close()

                await connector.disconnect()
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        except Exception as e:
            print(f"Discovery error for {connector_type} target {target}: {e}")
            if connector:
                try: await connector.disconnect()
                except: pass
            raise HTTPException(status_code=500, detail=f"Discovery failed: {str(e)}")
            
        return {"results": sorted(results) if results else []}

    async def preview_data(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch a sample of data from a specific table."""
        connector_type = (config.get("type") or "").lower()
        table_name = config.get("table_name")
        schema_name = config.get("schema_name") or "public"
        
        if os.getenv("USE_MOCK_DB") == "true" and os.getenv("REAL_EXTERNAL_CONNECTORS") != "true":
            sample_data = [
                {"id": 1, "name": "System Admin", "email": "admin@astraflow.ai", "role": "superuser"},
                {"id": 2, "name": "Data Enigneer", "email": "engineer@astraflow.ai", "role": "staff"},
                {"id": 3, "name": "Growth Analyst", "email": "analyst@astraflow.ai", "role": "user"},
            ]
            return {"data": sample_data, "columns": ["id", "name", "email", "role"]}

        # Real implementation would call connector.read_records with a limit
        # This will be fully implemented in Phase 5: Connector Engine
        return {"data": [], "columns": [], "message": "Preview not available in current environment"}
