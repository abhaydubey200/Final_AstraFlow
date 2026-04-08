import os
import time
import asyncio
from typing import List, Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorClient
from core.base_connector import BaseConnector
from core.healing_monitor import runtime_monitor

class MongoDBConnector(BaseConnector):
    @classmethod
    def get_config_schema(cls) -> Dict[str, Any]:
        return {
            "title": "MongoDB Connection",
            "type": "object",
            "required": ["uri"],
            "properties": {
                "uri": {
                    "title": "Connection URI", 
                    "type": "string", 
                    "placeholder": "mongodb://user:pass@localhost:27017/admin",
                    "description": "The full MongoDB connection string."
                },
                "database": {"title": "Default Database", "type": "string", "placeholder": "my_database"}
            }
        }

    @classmethod
    def get_capabilities(cls) -> Dict[str, Any]:
        return {
            "supports_cdc": False,
            "supports_incremental": True,
            "supports_parallel_reads": False,
            "supports_transactions": False,
            "max_connections": 50
        }

    def __init__(self, config: Dict[str, Any]):
        # MongoDB uses a URI, so normalization might be different
        self.config = config
        self.client: Optional[AsyncIOMotorClient] = None
        self.uri = config.get("uri") or config.get("host") # host might be used as URI in some UI flows

    @runtime_monitor.trace_and_heal(component="mongodb")
    async def connect(self) -> bool:
        if not self.uri:
            return False
            
        if "mock" in self.uri or "demo" in self.uri:
            self.client = "MOCK_CLIENT"
            return True

        try:
            self.client = AsyncIOMotorClient(self.uri, serverSelectionTimeoutMS=5000)
            # Trigger a connection check
            await self.client.admin.command('ping')
            return True
        except Exception as e:
            print(f"MongoDB connection error: {e}")
            return False

    async def health_check(self) -> bool:
        if self.client is None:
            return False
        if self.client == "MOCK_CLIENT":
            return True
        try:
            await self.client.admin.command('ping')
            return True
        except Exception:
            return False

    async def _acquire_connection(self) -> Any:
        if not self.client:
            await self.connect()
        return self.client

    async def _release_connection(self, conn: Any):
        pass # Motor manages its own pool

    @runtime_monitor.trace_and_heal(component="mongodb")
    async def discover_schema(self) -> List[Dict[str, Any]]:
        client = await self._acquire_connection()
        if client == "MOCK_CLIENT":
            return [{
                "schema": "default",
                "name": "mock_collection",
                "columns": [
                    {"name": "_id", "type": "objectId", "nullable": False, "is_primary_key": True},
                    {"name": "name", "type": "string", "nullable": True},
                    {"name": "value", "type": "number", "nullable": True}
                ],
                "primary_key": "_id"
            }]

        db_name = self.config.get("database")
        if not db_name:
            # Fallback to listing all DBs if no default is provided
            dbs = await client.list_database_names()
            db_name = dbs[0] if dbs else "admin"

        db = client[db_name]
        collections = await db.list_collection_names()
        
        results = []
        for col_name in collections:
            # Sample a document to infer "columns"
            sample = await db[col_name].find_one()
            columns = []
            if sample:
                for k, v in sample.items():
                    columns.append({
                        "name": k,
                        "type": type(v).__name__,
                        "nullable": True,
                        "is_primary_key": k == "_id"
                    })
            else:
                columns = [{"name": "_id", "type": "objectId", "nullable": False, "is_primary_key": True}]

            results.append({
                "schema": db_name,
                "name": col_name,
                "columns": columns,
                "primary_key": "_id"
            })
        return results

    async def read_records(self, table_name: str, sync_mode: str, cursor: Optional[Any] = None) -> List[Dict[str, Any]]:
        client = await self._acquire_connection()
        if client == "MOCK_CLIENT": return []
        
        db_name, col_name = table_name.split(".") if "." in table_name else (self.config.get("database", "admin"), table_name)
        db = client[db_name]
        col = db[col_name]
        
        query = {}
        if sync_mode == "incremental" and cursor:
            query = {"_id": {"$gt": cursor}}
            
        cursor_obj = col.find(query).limit(1000)
        return await cursor_obj.to_list(length=1000)

    async def write_records(self, table_name: str, records: List[Dict[str, Any]]) -> bool:
        client = await self._acquire_connection()
        if client == "MOCK_CLIENT": return True
        
        db_name, col_name = table_name.split(".") if "." in table_name else (self.config.get("database", "admin"), table_name)
        db = client[db_name]
        col = db[col_name]
        
        if records:
            await col.insert_many(records)
            return True
        return False

    async def read_chunked(self, table_name: str, chunk_size: int, partition_config: Optional[Dict[str, Any]] = None):
        client = await self._acquire_connection()
        if client == "MOCK_CLIENT": return
        
        db_name, col_name = table_name.split(".") if "." in table_name else (self.config.get("database", "admin"), table_name)
        col = client[db_name][col_name]
        
        async for doc in col.find({}):
            yield [doc] # Real chunking would involve limit/skip or cursors

    async def discover_resources(self, target: str, **kwargs) -> List[Any]:
        client = await self._acquire_connection()
        if client == "MOCK_CLIENT":
            if target == "databases": return ["mock_db"]
            if target == "collections" or target == "tables": return ["mock_col"]
            return []

        if target == "databases":
            return await client.list_database_names()
        elif target == "collections" or target == "tables":
            db_name = kwargs.get("database_name") or self.config.get("database")
            if not db_name: return []
            return await client[db_name].list_collection_names()
        elif target == "schemas":
            return ["default"] # MongoDB typically doesn't have "schemas" like SQL
        return []

    async def diagnose(self) -> Dict[str, Any]:
        report = {"dns_resolution": "pending", "tcp_connection": "pending", "authentication": "pending", "status": "pending", "latency_ms": 0}
        start = time.time()
        try:
            # For MongoDB URI, we'd need to parse it to check DNS/TCP specifically
            # but ping covers most of it.
            if await self.health_check():
                report["dns_resolution"] = "success"
                report["tcp_connection"] = "success"
                report["authentication"] = "success"
                report["status"] = "healthy"
            else:
                report["status"] = "unhealthy"
        except Exception as e:
            report["status"] = f"failed: {str(e)}"
        
        report["latency_ms"] = int((time.time() - start) * 1000)
        return report

    async def disconnect(self):
        if self.client and self.client != "MOCK_CLIENT":
            self.client.close()
        self.client = None
