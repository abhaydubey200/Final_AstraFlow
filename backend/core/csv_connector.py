import os
import time
import asyncio
import pandas as pd
from typing import List, Dict, Any, Optional
from core.base_connector import BaseConnector
from core.healing_monitor import runtime_monitor

class CSVConnector(BaseConnector):
    @classmethod
    def get_config_schema(cls) -> Dict[str, Any]:
        return {
            "title": "CSV/JSON File Connection",
            "type": "object",
            "required": ["path"],
            "properties": {
                "path": {
                    "title": "File Path / URL", 
                    "type": "string", 
                    "placeholder": "C:/data/sales.csv",
                    "description": "Full path to the local CSV/JSON file or a reachable URL."
                },
                "delimiter": {"title": "Delimiter", "type": "string", "default": ","},
                "has_header": {"title": "Has Header", "type": "boolean", "default": True}
            }
        }

    @classmethod
    def get_capabilities(cls) -> Dict[str, Any]:
        return {
            "supports_cdc": False,
            "supports_incremental": False,
            "supports_parallel_reads": False,
            "supports_transactions": False,
            "max_connections": 1
        }

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.path = config.get("path")
        self.delimiter = config.get("delimiter", ",")
        self.is_connected = False

    @runtime_monitor.trace_and_heal(component="file")
    async def connect(self) -> bool:
        if not self.path:
            return False
            
        if "mock" in self.path or "demo" in self.path:
            self.is_connected = True
            return True

        if os.path.exists(self.path):
            self.is_connected = True
            return True
        elif self.path.startswith("http"):
            # Could check URL accessibility here
            self.is_connected = True
            return True
        return False

    async def health_check(self) -> bool:
        if not self.path: return False
        return os.path.exists(self.path) or self.path.startswith("http")

    async def _acquire_connection(self) -> Any:
        return self.path

    async def _release_connection(self, conn: Any):
        pass

    @runtime_monitor.trace_and_heal(component="file")
    async def discover_schema(self) -> List[Dict[str, Any]]:
        if "mock" in self.path:
            return [{
                "schema": "local",
                "name": "mock_file",
                "columns": [
                    {"name": "col1", "type": "string", "nullable": True, "is_primary_key": False},
                    {"name": "col2", "type": "number", "nullable": True, "is_primary_key": False}
                ],
                "primary_key": None
            }]

        try:
            # For simplicity, read just the first few rows
            if self.path.endswith(".json"):
                df = pd.read_json(self.path).head(5)
            else:
                df = pd.read_csv(self.path, sep=self.delimiter, nrows=5)
                
            columns = []
            for col_name, dtype in df.dtypes.items():
                columns.append({
                    "name": str(col_name),
                    "type": str(dtype),
                    "nullable": True,
                    "is_primary_key": False
                })
            
            return [{
                "schema": os.path.dirname(self.path),
                "name": os.path.basename(self.path),
                "columns": columns,
                "primary_key": None
            }]
        except Exception as e:
            print(f"Error discovering CSV schema: {e}")
            return []

    async def read_records(self, table_name: str, sync_mode: str, cursor: Optional[Any] = None) -> List[Dict[str, Any]]:
        try:
            if self.path.endswith(".json"):
                df = pd.read_json(self.path)
            else:
                df = pd.read_csv(self.path, sep=self.delimiter)
            return df.to_dict(orient="records")
        except Exception:
            return []

    async def write_records(self, table_name: str, records: List[Dict[str, Any]]) -> bool:
        # File writing could be implemented if needed
        return False

    async def read_chunked(self, table_name: str, chunk_size: int, partition_config: Optional[Dict[str, Any]] = None):
        try:
            if self.path.endswith(".csv"):
                for chunk in pd.read_csv(self.path, sep=self.delimiter, chunksize=chunk_size):
                    yield chunk.to_dict(orient="records")
            else:
                # JSON/Parquet chunking is different
                pass
        except Exception:
            pass

    async def discover_resources(self, target: str, **kwargs) -> List[Any]:
        if target == "tables" or target == "files":
            return [os.path.basename(self.path)]
        return []

    async def diagnose(self) -> Dict[str, Any]:
        report = {"dns_resolution": "success", "tcp_connection": "success", "authentication": "success", "status": "healthy", "latency_ms": 0}
        start = time.time()
        if not await self.health_check():
            report["status"] = "failed: file not found or unreachable"
        report["latency_ms"] = int((time.time() - start) * 1000)
        return report

    async def disconnect(self):
        pass
