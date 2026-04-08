import uuid
import json
import time
import asyncio
import threading
import logging
from fastapi import HTTPException
from typing import List, Dict, Any, Optional
from datetime import datetime
from core.base_connector import BaseConnector
from core.connector_registry import ConnectorRegistry
from services.metadata_service import MetadataService
from services.secret_service import SecretService
from services.capability_service import CapabilityService
from services.ai_service import AIService
from core.supabase_client import supabase, supabase_logger
from core.decorators import safe_execute
from core.data_utils import cached_supabase_call, invalidate_cache
import os

MOCK_STORE_PATH = os.path.join(os.path.dirname(__file__), "..", "mock_store.json")

# Thread-safe lock for mock store writes (10 concurrent users ready)
_mock_store_lock = threading.Lock()

# Logger for production (replaces debug file writes)
logger = logging.getLogger("connection_service")

class ConnectionService:
    def __init__(self, pool: Any = None):
        # Using Supabase SDK for all operations (Phase 2 Migration)
        self.supabase = supabase
        self.metadata_service = MetadataService()
        self.secret_service = SecretService()
        self.capability_service = CapabilityService()
        self.ai_service = AIService()
        self._pool_cache = {} 

    def _read_mock_store(self) -> Dict[str, Any]:
        """Reads local mock data for fallback."""
        if not os.path.exists(MOCK_STORE_PATH):
            return {"connections": [], "sync_configs": []}
        try:
            with open(MOCK_STORE_PATH, 'r') as f:
                return json.load(f)
        except Exception:
            return {"connections": [], "sync_configs": []}

    def _write_mock_store(self, data: Dict[str, Any]):
        """Thread-safe write to local mock store (10 concurrent users ready)."""
        with _mock_store_lock:
            try:
                with open(MOCK_STORE_PATH, 'w') as f:
                    json.dump(data, f, indent=2, default=str)
            except Exception as e:
                logger.warning(f"Failed to write mock store: {e}")

    def _mask_sensitive_fields(self, obj: Dict[str, Any]) -> Dict[str, Any]:
        """Remove sensitive fields (passwords) from objects before returning."""
        masked = dict(obj) if obj else {}
        masked.pop("password", None)
        if "config" in masked and isinstance(masked["config"], dict):
            config_copy = dict(masked["config"])
            config_copy.pop("password", None)
            masked["config"] = config_copy
        return masked

    @cached_supabase_call(ttl=60)
    @supabase_logger
    async def list_connections(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """Lists connections with manual SDK fallback to local mock."""
        try:
            res = self.supabase.table("connections")\
                .select("*, connection_performance(avg_latency_ms), connection_capabilities(supports_cdc, supports_incremental)")\
                .order("created_at", desc=True)\
                .range(offset, offset + limit - 1)\
                .execute()
            
            connections = []
            for row in res.data:
                perf = row.pop("connection_performance", [])
                caps = row.pop("connection_capabilities", [])
                row["avg_latency_ms"] = perf[0]["avg_latency_ms"] if perf else None
                if caps:
                    row["supports_cdc"] = caps[0]["supports_cdc"]
                    row["supports_incremental"] = caps[0]["supports_incremental"]
                else:
                    row["supports_cdc"] = False
                    row["supports_incremental"] = False
                connections.append(row)
                
            return connections
        except Exception as e:
            logger.warning(f"Supabase list failed, falling back to mock: {e}")
            mock_data = self._read_mock_store()
            return mock_data.get("connections", [])

    @safe_execute()
    async def get_connection(self, connection_id: str) -> Optional[Dict[str, Any]]:
        """Phase 2 Migration: Get connection with stats & caps (fallback to mock)."""
        try:
            res = self.supabase.table("connections")\
                .select("*, connection_performance(*), connection_capabilities(*)")\
                .eq("id", connection_id)\
                .execute()
            
            if res.data:
                row = res.data[0]
                perf = row.pop("connection_performance", [])
                caps = row.pop("connection_capabilities", [])
                
                if perf: row.update(perf[0])
                if caps: row.update(caps[0])
                
                return self._mask_sensitive_fields(row)
        except Exception as e:
            logger.warning(f"Supabase get failed for {connection_id}, checking mock: {e}")
            
        mock_data = self._read_mock_store()
        for conn in mock_data.get("connections", []):
            if str(conn.get("id")) == str(connection_id):
                return self._mask_sensitive_fields(conn)
        return None

    @supabase_logger
    async def delete_connection(self, connection_id: str):
        """Deletes connection via SDK and mock store with proper error handling."""
        try:
            self.supabase.table("connections").delete().eq("id", connection_id).execute()
            logger.info(f"Successfully deleted connection {connection_id} from Supabase")
        except Exception as e:
            logger.warning(f"Failed to delete from Supabase: {e}")
            
        # --- Sync to Mock Store ---
        mock_data = self._read_mock_store()
        original_count = len(mock_data.get("connections", []))
        mock_data["connections"] = [c for c in mock_data.get("connections", []) if str(c.get("id")) != str(connection_id)]
        new_count = len(mock_data.get("connections", []))
        
        if new_count < original_count:
            self._write_mock_store(mock_data)
            logger.info(f"Successfully deleted connection {connection_id} from mock store")
        
        invalidate_cache("list_connections")
        
        # Cleanup cached pool if it exists
        if connection_id in self._pool_cache:
            try:
                old_pool = self._pool_cache.pop(connection_id)
                await old_pool.close()
                logger.debug(f"Closed connection pool for {connection_id}")
            except Exception as e:
                logger.warning(f"Failed to close pool for {connection_id}: {e}")

    @safe_execute()
    async def create_connection(self, config: Dict[str, Any]):
        """Phase 2 Migration: Create connection and sync configs."""
        # --- PHASE 2B: Input Validation (MANDATORY) ---
        name = config.get("name", "").strip()
        conn_type = config.get("type", "").strip().lower()
        
        if not name:
            raise HTTPException(status_code=400, detail="Connection name is required")
        if not conn_type:
            raise HTTPException(status_code=400, detail="Connection type is required")
        
        # Validate connector type is supported (only 6 allowed)
        if conn_type not in ["postgresql", "mysql", "mssql", "snowflake", "mongodb", "oracle"]:
            raise HTTPException(status_code=400, detail=f"Unsupported connector type: {conn_type}")
        
        port = config.get("port")
        if not port:
            try:
                connector_class = ConnectorRegistry.get_connector_class(conn_type)
                schema = connector_class.get_config_schema()
                port = schema.get("properties", {}).get("port", {}).get("default", 0)
            except Exception as e:
                logger.warning(f"Failed to get default port for {conn_type}: {e}")
                port = 0
        
        conn_id = None
        
        # Try Supabase first, fall back to UUID if it fails
        try:
            conn_res = self.supabase.table("connections").insert({
                "name": config.get("name"),
                "type": config.get("type"),
                "host": config.get("host"),
                "port": port,
                "username": config.get("username") or config.get("user"),
                "ssl_enabled": config.get("ssl_enabled", False),
            }).execute()
            
            if conn_res.data:
                conn_id = conn_res.data[0]['id']
                logger.info(f"Created connection {conn_id} in Supabase")
        except Exception as e:
            logger.warning(f"Supabase insert failed, using local UUID: {e}")
            # Generate local ID if Supabase fails
            conn_id = str(uuid.uuid4())
        
        if not conn_id:
            # If still no ID, create one
            conn_id = str(uuid.uuid4())
        
        # Use SecretService for credentials
        if config.get("password"):
            try:
                await self.secret_service.store_secret(str(conn_id), 'password', config.get("password"))
                logger.debug(f"Stored password for connection {conn_id}")
            except Exception as e:
                logger.warning(f"Could not store secret for {conn_id}: {e}")
            
        # Initial capability detection
        try:
            await self.capability_service.detect_capabilities({**config, "connection_id": str(conn_id)})
            logger.info(f"Detected capabilities for {conn_id}")
        except Exception as e:
            logger.warning(f"Capability detection failed for {conn_id}: {e}")
        
        # Persist Sync Configs
        selected_tables = config.get("selected_tables", [])
        sync_configs = config.get("sync_configs", {})
        
        sync_records = []
        for table_meta in selected_tables:
            table_name = table_meta.get("name") if isinstance(table_meta, dict) else table_meta
            schema_name = table_meta.get("schema", "public") if isinstance(table_meta, dict) else "public"
            table_sync = sync_configs.get(table_name, {})
            
            sync_records.append({
                "connection_id": conn_id,
                "table_name": table_name,
                "schema_name": schema_name,
                "sync_mode": table_sync.get("mode", "full_refresh"),
                "cursor_field": table_sync.get("cursorField"),
                "primary_key": table_sync.get("primaryKey"),
                "selected_columns": table_sync.get("columns", [])
            })
            
        if sync_records:
            try:
                self.supabase.table("sync_configs").insert(sync_records).execute()
                logger.info(f"Created {len(sync_records)} sync configs for connection {conn_id}")
            except Exception as e:
                logger.warning(f"Failed to create sync configs: {e}")
            
        # --- ALWAYS Sync to Mock Store (Primary storage in mock mode) ---
        # PHASE 2B: NEVER store raw password in mock_store.json
        mock_data = self._read_mock_store()
        new_conn = {
            "id": str(conn_id),
            "name": config.get("name"),
            "type": config.get("type"),
            "host": config.get("host"),
            "port": port,
            "username": config.get("username") or config.get("user"),
            "database_name": config.get("database_name") or config.get("database") or "",
            "ssl_enabled": config.get("ssl_enabled", False),
            "status": config.get("status", "connected"),
            "is_active": True,
            "created_by": "admin",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "last_tested_at": config.get("last_tested_at", None),
            "selected_tables": config.get("selected_tables", []),
            # NOTE: password intentionally omitted — stored via SecretService only
            "_has_password": bool(config.get("password"))  # only store a boolean flag
        }
        mock_data["connections"].append(new_conn)
        self._write_mock_store(mock_data)
        logger.info(f"Synced new connection {conn_id} to mock store")
            
        invalidate_cache("list_connections")
        return self._mask_sensitive_fields(new_conn)
            
    @safe_execute()
    async def update_connection(self, connection_id: str, config: Dict[str, Any]):
        """Phase 2 Migration: Update connection metadata."""
        try:
            port = config.get("port")
            if not port:
                port = {"postgresql": 5432, "snowflake": 443, "mysql": 3306, "mssql": 1433}.get(config.get("type"), 0)
            
            update_data = {
                "name": config.get("name"),
                "host": config.get("host"),
                "port": port,
                "username": config.get("username") or config.get("user"),
                "ssl_enabled": config.get("ssl_enabled", False),
                "updated_at": datetime.now().isoformat()
            }
            
            self.supabase.table("connections").update(update_data).eq("id", connection_id).execute()
            logger.info(f"Updated connection {connection_id} in Supabase")
        except Exception as e:
            logger.warning(f"Failed to update in Supabase: {e}")
        
        # Update password if provided
        if config.get("password"):
            try:
                await self.secret_service.store_secret(connection_id, 'password', config.get("password"))
                logger.debug(f"Updated password for connection {connection_id}")
            except Exception as e:
                logger.warning(f"Failed to update password: {e}")
        
        # Invalidate cached pool
        if connection_id in self._pool_cache:
            try:
                old_pool = self._pool_cache.pop(connection_id)
                await old_pool.close()
                logger.debug(f"Closed pool for {connection_id}")
            except Exception as e:
                logger.warning(f"Failed to close pool: {e}")
        
        # --- Sync to Mock Store ---
        mock_data = self._read_mock_store()
        for i, conn in enumerate(mock_data.get("connections", [])):
            if str(conn.get("id")) == str(connection_id):
                mock_data["connections"][i].update({
                    "name": config.get("name"),
                    "host": config.get("host"),
                    "port": port,
                    "username": config.get("username") or config.get("user"),
                    "ssl_enabled": config.get("ssl_enabled", False),
                    "updated_at": datetime.now().isoformat()
                })
                break
        self._write_mock_store(mock_data)
        logger.info(f"Updated connection {connection_id} in mock store")
        
        invalidate_cache("list_connections")
        return {"id": connection_id, "status": "updated"}

    async def get_secrets(self, connection_id: str) -> Dict[str, Any]:
        """Fetches secrets via SecretService."""
        password = await self.secret_service.get_secret(connection_id, 'password')
        return {"password": password} if password else {}

    async def test_connection(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Test a connection and return a detailed diagnostic report with timeout and retry."""
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
            
            # PHASE 2B: Add timeout (5s) and retry (max 2 attempts)
            report = None
            for attempt in range(2):
                try:
                    report = await asyncio.wait_for(connector.diagnose(), timeout=5.0)
                    break  # Success, exit retry loop
                except asyncio.TimeoutError:
                    if attempt == 1:  # Last attempt failed
                        logger.warning(f"Connection test timed out after 5s (2 retries)")
                        return {
                            "success": False,
                            "latency_ms": 5000,
                            "message": "Connection timed out after 5 seconds (2 retries)",
                            "error": "timeout",
                            "diagnostics": {"timeout": "exceeded 5s limit"}
                        }
                    # First attempt failed, retry
                    logger.info(f"Connection test attempt {attempt + 1} timed out, retrying...")
                    await asyncio.sleep(0.5)  # Brief pause before retry
            
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
                "status": "success" if success else "failed",  # Add for legacy compatibility
                "latency_ms": report.get("latency_ms", 0),
                "message": "Connection verified" if success else "Diagnostic failure identified",
                "diagnostics": report,
                "error": next((v for k, v in report.items() if isinstance(v, str) and "failed" in v), None),
                "suggestion": report.get("ai_suggestion", {}).get("fix")
            }
        except Exception as e:
            logger.error(f"test_connection error: {str(e)}")
            return {
                "success": False,
                "status": "failed",
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

    @safe_execute()
    async def _update_performance(self, connection_id: str, latency: int):
        """Phase 2 Migration: Upsert performance metrics."""
        self.supabase.table("connection_performance").upsert({
            "connection_id": connection_id,
            "avg_latency_ms": float(latency),
            "updated_at": "now()"
        }).execute()

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
                    logger.warning(f"Warning: Could not save schema for connection {connection_id}: {e}")

            return {"tables": tables_data, "supported": True, "count": len(tables_data), "cached": False}

        except ValueError as e:
            return {"tables": [], "supported": False, "message": f"Unsupported connector: {str(e)}"}
        except asyncio.TimeoutError:
            return {"tables": [], "supported": False, "message": "Discovery timed out after 30s"}
        except Exception as e:
            # PHASE 2B: Replace file write with proper logging
            logger.error(f"Schema discovery error: {str(e)}", exc_info=True)
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
            
            # Validate connector type is provided
            if not connector_type:
                logger.error("Discovery attempt without connector type")
                raise HTTPException(status_code=400, detail="Connection type is required for discovery")
            
            logger.info(f"Discovery request - type={connector_type}, connection_id={connection_id}, has_host={bool(config.get('host'))}, has_username={bool(config.get('username'))}")
            
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
            
            logger.info(f"After normalization - has_user={bool(normalized_config.get('user'))}, has_username={bool(normalized_config.get('username'))}, has_host={bool(normalized_config.get('host'))}")
            
            # Validate required fields based on connector type
            # Note: warehouse/schema can be optional for discovery, we'll use defaults if missing
            if connector_type == "snowflake":
                critical_fields = ["host", "user"]  # warehouse/database can come from defaults
                missing = [f for f in critical_fields if not normalized_config.get(f)]
                if missing:
                    logger.warning(f"Missing critical Snowflake fields: {missing}. Available fields: {list(normalized_config.keys())}")
                    raise HTTPException(
                        status_code=400,
                        detail=f"Missing required Snowflake fields: {', '.join(missing)}"
                    )
                # Fill in warehouse with default if missing
                if not normalized_config.get("warehouse"):
                    normalized_config["warehouse"] = config.get("warehouse_name") or "COMPUTE_WH"
                # Fill in database with default if missing
                if not normalized_config.get("database"):
                    normalized_config["database"] = config.get("database_name") or "DEFAULT"
                    
            elif connector_type in ["postgresql", "mysql", "mssql"]:
                required_fields = ["host", "user"]  # database can be optional for discovery
                missing = [f for f in required_fields if not normalized_config.get(f)]
                if missing:
                    logger.warning(f"Missing critical fields for {connector_type}: {missing}")
                    raise HTTPException(
                        status_code=400,
                        detail=f"Missing required fields: {', '.join(missing)}"
                    )
                # Fill in database with default if missing
                if not normalized_config.get("database"):
                    normalized_config["database"] = config.get("database_name") or "postgres"
            
            # Ensure password is included
            has_password = bool(normalized_config.get("password"))
            if not has_password and connection_id:
                secret_password = await self.secret_service.get_secret(str(connection_id), "password")
                if secret_password:
                    normalized_config["password"] = secret_password
                    has_password = True
            
            # Password is required for most connectors
            if not has_password and connector_type not in ["csv", "json", "parquet"]:
                raise HTTPException(
                    status_code=400,
                    detail="Password is required for authentication"
                )
                
            # PHASE 2B: Use proper logging instead of file writes
            logger.info(f"Discovery attempt - type={connector_type}, target={target}, connection_id={connection_id}")

            results = []
            connector = None

            connector_class = ConnectorRegistry.get_connector_class(connector_type)
            connector = connector_class(normalized_config)
            
            # PHASE 2B: Add timeout to connect() and discover_resources()
            try:
                connected = await asyncio.wait_for(connector.connect(), timeout=5.0)
            except asyncio.TimeoutError:
                logger.warning(f"Connection timeout for {connector_type}")
                raise HTTPException(status_code=408, detail="Connection timed out after 5s")
            
            if connected:
                # Prioritize database_name from config, then fallback to normalized_config
                database_name = config.get("database_name") or config.get("database") or normalized_config.get("database")
                
                logger.debug(f"Discovery context - database: {database_name}")
                
                try:
                    results = await asyncio.wait_for(
                        connector.discover_resources(target, database_name=database_name),
                        timeout=10.0
                    )
                except asyncio.TimeoutError:
                    logger.warning(f"Discovery timed out for {target}")
                    raise HTTPException(status_code=408, detail="Discovery timed out after 10s")
                finally:
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

        except HTTPException:
            raise  # Re-raise HTTP exceptions as-is
        except Exception as e:
            logger.error(f"Global error in discover_resources: {str(e)}", exc_info=True)
            
            error_str = str(e)
            if connector: 
                try:
                    await connector.disconnect()
                except Exception as e2:
                    logger.debug(f"Failed to disconnect: {e2}")
            
            if "snowflake" in connector_type and ("does not exist" in error_str.lower() or "not authorized" in error_str.lower()):
                 raise HTTPException(status_code=403, detail=f"Snowflake Access Error: {error_str}")
            
            raise HTTPException(status_code=500, detail=f"Discovery failed: {str(e)}")


    async def preview_data(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch a sample of data from a specific table with real connector if available."""
        connector_type = (config.get("type") or "").lower()
        table_name = config.get("table_name")
        schema_name = config.get("schema_name") or "public"
        connection_id = config.get("id") or config.get("connection_id")
        
        logger.info(f"Previewing data from {table_name} in {connector_type}")
        
        if os.getenv("USE_MOCK_DB") == "true" and os.getenv("REAL_EXTERNAL_CONNECTORS") != "true":
            logger.debug("Using mock data preview")
            sample_data = [
                {"id": 1, "name": "System Admin", "email": "admin@astraflow.ai", "role": "superuser"},
                {"id": 2, "name": "Data Engineer", "email": "engineer@astraflow.ai", "role": "staff"},
                {"id": 3, "name": "Growth Analyst", "email": "analyst@astraflow.ai", "role": "user"},
            ]
            return {"data": sample_data, "columns": ["id", "name", "email", "role"], "count": 3}

        # Try to get real preview from connector
        try:
            # Ensure password is included
            password = config.get("password")
            if not password and connection_id:
                try:
                    password = await self.secret_service.get_secret(str(connection_id), "password")
                except Exception as e:
                    logger.warning(f"Failed to retrieve password: {e}")
            
            if not password:
                logger.warning(f"No password available for preview")
                return {"data": [], "columns": [], "message": "No password available for connection"}
            
            normalized_config = BaseConnector.normalize_config({**config, "password": password})
            connector_class = ConnectorRegistry.get_connector_class(connector_type)
            connector = connector_class(normalized_config)
            
            try:
                connected = await asyncio.wait_for(connector.connect(), timeout=5.0)
                if not connected:
                    logger.warning(f"Could not connect for preview")
                    return {"data": [], "columns": [], "message": "Could not establish connection"}
                
                # Read sample records (limit to 10)
                try:
                    sample_records = await asyncio.wait_for(
                        connector.read_records(
                            schema=schema_name,
                            table=table_name,
                            limit=10
                        ),
                        timeout=10.0
                    )
                    
                    if sample_records:
                        # Extract columns from first record
                        columns = list(sample_records[0].keys()) if isinstance(sample_records[0], dict) else []
                        logger.info(f"Successfully previewed {len(sample_records)} records from {table_name}")
                        return {
                            "data": sample_records,
                            "columns": columns,
                            "count": len(sample_records)
                        }
                    else:
                        logger.info(f"No data found in {table_name}")
                        return {"data": [], "columns": [], "message": f"No data in {table_name}"}
                        
                except asyncio.TimeoutError:
                    logger.warning(f"Preview query timed out")
                    return {"data": [], "columns": [], "message": "Preview query timed out after 10s"}
            finally:
                try:
                    await connector.disconnect()
                except Exception as e:
                    logger.debug(f"Failed to disconnect: {e}")
                    
        except Exception as e:
            logger.error(f"Preview data error: {str(e)}", exc_info=True)
            return {"data": [], "columns": [], "message": f"Preview failed: {str(e)}"}
