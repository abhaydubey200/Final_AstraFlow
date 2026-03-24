import os
import uuid
import json
import asyncpg
import time
import asyncio
from fastapi import HTTPException
from typing import List, Dict, Any, Optional
from datetime import datetime
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

    async def test_connection(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Test a connection and return a detailed diagnostic report."""
        # Handle cases where config is nested or keys are at top level
        config = payload.get("config", payload) if isinstance(payload.get("config"), dict) else payload
        
        connector_type = payload.get("connector_type") or config.get("type") or "postgresql"
        
        # Resolve password if connection_id provided
        password = config.get("password")
        connection_id = config.get("id") or config.get("connection_id") or payload.get("connection_id")
        
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
        """Discovers the schema for a connection, using cache if available."""
        connection_id = config.get("id") or config.get("connection_id")
        connector_type = (config.get("type") or config.get("connector_type") or "").lower()
        
        # If type is missing but we have an ID, fetch the connection from DB
        if not connector_type and connection_id:
            db_conn = await self.get_connection(str(connection_id))
            if db_conn:
                merged = dict(db_conn)
                merged.update(config)
                config = merged
                connector_type = (config.get("type") or "").lower()

        # 1. Normalize config
        normalized_config = BaseConnector.normalize_config(config)
        
        # 2. Check cache if ID exists (unless force_refresh is requested)
        if connection_id and not config.get("force_refresh"):
            try:
                # Validate UUID before passing to MetadataService
                import uuid
                uuid.UUID(str(connection_id))
                cached = await self.metadata_service.get_cached_schema(str(connection_id))
                if cached:
                    return {"tables": cached, "supported": True, "count": len(cached), "cached": True}
            except (ValueError, Exception) as e:
                print(f"Warning: Metadata cache lookup failed or skipped for {connection_id}: {e}")

        # 3. Perform live discovery
        try:
            connector_class = ConnectorRegistry.get_connector_class(connector_type)
            connector = connector_class(normalized_config)
            
            tables_data = await asyncio.wait_for(
                self._run_schema_discovery(connector), 
                timeout=30.0
            )

            if tables_data is None:
                return {"tables": [], "supported": False, "message": "Could not connect to service"}

            # --- Intelligent Recommendation ---
            capabilities = connector.get_capabilities()
            for table in tables_data:
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
            
            # 5. Save to metadata repository if we have a valid UUID
            if connection_id and tables_data:
                try:
                    import uuid
                    uuid.UUID(str(connection_id))
                    await self.metadata_service.save_schema(str(connection_id), tables_data)
                except (ValueError, Exception) as e:
                    print(f"Warning: Could not save schema for connection {connection_id}: {e}")

            return {"tables": tables_data, "supported": True, "count": len(tables_data), "cached": False}

        except ValueError as e:
            return {"tables": [], "supported": False, "message": f"Unsupported connector: {str(e)}"}
        except asyncio.TimeoutError:
            return {"tables": [], "supported": False, "message": "Discovery timed out after 30s"}
        except Exception as e:
            with open("discovery_error.txt", "a") as f:
                import traceback
                f.write(f"\n--- Error in get_schema at {datetime.now()} ---\n")
                traceback.print_exc(file=f)
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
        try:
            connection_id = config.get("connection_id") or config.get("id")
            connector_type = (config.get("type") or config.get("connector_type") or "").lower()
            
            # If we have an ID, fetch the connection from DB to get host/user/etc.
            if connection_id:
                db_conn = await self.get_connection(str(connection_id))
                if db_conn:
                    # Merge db metadata with incoming config
                    merged = dict(db_conn)
                    merged.update(config)
                    config = merged
                    if not connector_type:
                        connector_type = (config.get("type") or "").lower()

            target = config.get("target", "databases")
            
            # Use unified normalization
            normalized_config = BaseConnector.normalize_config(config)
            
            # Ensure password is included
            has_password = bool(normalized_config.get("password"))
            if not has_password and connection_id:
                secret_password = await self.secret_service.get_secret(str(connection_id), "password")
                if secret_password:
                    normalized_config["password"] = secret_password
                    has_password = True
                
            # DEBUG: Log discovery attempt
            with open("discovery_error.txt", "a") as f:
                f.write(f"\n--- Discovery Attempt --- {datetime.now()}\n")
                f.write(f"Connection ID: {connection_id}\n")
                f.write(f"Connector Type: {connector_type}\n")
                f.write(f"Target: {target}\n")
                f.write(f"Has Password: {has_password}\n")
                if has_password:
                    f.write(f"Password Length: {len(normalized_config.get('password', ''))}\n")
                else:
                    f.write("WARNING: No password found for discovery!\n")
                f.write(f"Normalized Config Keys: {list(normalized_config.keys())}\n")

            results = []
            connector = None

            connector_class = ConnectorRegistry.get_connector_class(connector_type)
            connector = connector_class(normalized_config)
            
            if await connector.connect():
                # Prioritize database_name from config, then fallback to normalized_config
                database_name = config.get("database_name") or config.get("database") or normalized_config.get("database")
                
                with open("discovery_error.txt", "a") as f:
                    f.write(f"Discovery Context - DB: {database_name}\n")
                
                results = await connector.discover_resources(target, database_name=database_name)
                await connector.disconnect()

            # Sort results safely
            if results:
                try:
                    if isinstance(results[0], dict):
                        results.sort(key=lambda x: str(x.get("name", "")))
                    else:
                        results.sort()
                except Exception:
                    pass

            return {"results": results or []}

        except Exception as e:
            # Log to dedicated file for debugging
            with open("discovery_error.txt", "a") as f:
                import traceback
                f.write(f"\n--- Global Error in discover_resources at {datetime.now()} ---\n")
                f.write(f"Config keys: {list(config.keys())}\n")
                f.write(f"Connector Type: {connector_type}\n")
                traceback.print_exc(file=f)
            
            error_str = str(e)
            if connector: 
                try: await connector.disconnect()
                except: pass
            
            if "snowflake" in connector_type and ("does not exist" in error_str.lower() or "not authorized" in error_str.lower()):
                 raise HTTPException(status_code=403, detail=f"Snowflake Access Error: {error_str}")
            
            raise HTTPException(status_code=500, detail=f"Discovery failed: {str(e)}")


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
