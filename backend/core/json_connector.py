import os
import time
import json
import asyncio
from typing import List, Dict, Any, Optional
from core.base_connector import BaseConnector

class JSONConnector(BaseConnector):
    """Connector for JSON and JSON-Lines files."""

    @classmethod
    def get_config_schema(cls) -> Dict[str, Any]:
        return {
            "title": "JSON File Connection",
            "type": "object",
            "required": ["path"],
            "properties": {
                "path": {
                    "title": "File Path / URL",
                    "type": "string",
                    "placeholder": "C:/data/records.json or https://example.com/data.json",
                    "description": "Full path to a local JSON file or a reachable HTTP(S) URL."
                },
                "is_jsonlines": {
                    "title": "JSON Lines Format",
                    "type": "boolean",
                    "default": False,
                    "description": "Enable if the file has one JSON object per line (NDJSON / JSON-Lines)."
                },
                "record_path": {
                    "title": "Record Path (optional)",
                    "type": "string",
                    "default": "",
                    "description": "Dot-notation path to the records array inside the JSON. E.g. 'data.items'."
                }
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
        self.path: str = config.get("path", "")
        self.is_jsonlines: bool = config.get("is_jsonlines", False)
        self.record_path: str = config.get("record_path", "")

    # ─────────────────────────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────────────────────────
    def _path_valid(self) -> bool:
        if not self.path:
            return False
        if self.path.startswith("http://") or self.path.startswith("https://"):
            return True
        return os.path.isfile(self.path)

    def _load_records(self, max_rows: int = 1000) -> List[Dict[str, Any]]:
        """Load up to *max_rows* records and return them as a list of dicts."""
        if self.path.startswith("http://") or self.path.startswith("https://"):
            import urllib.request
            with urllib.request.urlopen(self.path, timeout=10) as resp:
                raw = resp.read().decode("utf-8")
        else:
            with open(self.path, "r", encoding="utf-8") as f:
                raw = f.read()

        if self.is_jsonlines:
            records: List[Any] = []
            for line in raw.splitlines():
                line = line.strip()
                if line:
                    records.append(json.loads(line))
                    if len(records) >= max_rows:
                        break
        else:
            data = json.loads(raw)
            # Navigate record_path if specified
            if self.record_path:
                for key in self.record_path.split("."):
                    if isinstance(data, dict) and key in data:
                        data = data[key]
                    else:
                        data = []
                        break
            if isinstance(data, list):
                records = data[:max_rows]
            elif isinstance(data, dict):
                records = [data]
            else:
                records = []

        # Ensure all items are dicts
        return [r for r in records if isinstance(r, dict)]

    def _infer_columns(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Infer column names and types from sampled records."""
        type_map: Dict[str, str] = {}
        for rec in records:
            for k, v in rec.items():
                if k not in type_map:
                    if isinstance(v, bool):
                        type_map[k] = "boolean"
                    elif isinstance(v, int):
                        type_map[k] = "integer"
                    elif isinstance(v, float):
                        type_map[k] = "float"
                    elif isinstance(v, dict):
                        type_map[k] = "object"
                    elif isinstance(v, list):
                        type_map[k] = "array"
                    else:
                        type_map[k] = "string"
        return [
            {"name": col, "type": dtype, "nullable": True, "is_primary_key": False}
            for col, dtype in type_map.items()
        ]

    # ─────────────────────────────────────────────────────────────
    # BaseConnector interface
    # ─────────────────────────────────────────────────────────────
    async def connect(self) -> bool:
        return self._path_valid()

    async def health_check(self) -> bool:
        return self._path_valid()

    async def _acquire_connection(self) -> Any:
        return self.path

    async def _release_connection(self, conn: Any):
        pass

    async def discover_schema(self) -> List[Dict[str, Any]]:
        if not self._path_valid():
            return []
        try:
            records = await asyncio.to_thread(self._load_records, 100)
            if not records:
                return [{
                    "schema": "local",
                    "name": os.path.basename(self.path) if os.path.isfile(self.path) else "json_source",
                    "columns": [],
                    "primary_key": None,
                    "row_count_estimate": 0
                }]
            columns = self._infer_columns(records)
            return [{
                "schema": "local",
                "name": os.path.basename(self.path) if os.path.isfile(self.path) else "json_source",
                "columns": columns,
                "primary_key": None,
                "row_count_estimate": len(records)
            }]
        except Exception as e:
            print(f"[JSONConnector] Schema discovery error: {e}")
            return []

    async def read_records(self, table_name: str, sync_mode: str, cursor: Optional[Any] = None) -> List[Dict[str, Any]]:
        try:
            return await asyncio.to_thread(self._load_records, 10_000)
        except Exception:
            return []

    async def write_records(self, table_name: str, records: List[Dict[str, Any]]) -> bool:
        return False

    async def read_chunked(self, table_name: str, chunk_size: int, partition_config: Optional[Dict[str, Any]] = None):
        try:
            all_records = await asyncio.to_thread(self._load_records, 10_000)
            for i in range(0, len(all_records), chunk_size):
                yield all_records[i: i + chunk_size]
        except Exception:
            return

    async def discover_resources(self, target: str, **kwargs) -> List[Any]:
        name = os.path.basename(self.path) if self.path else "json_source"
        return [name]

    async def diagnose(self) -> Dict[str, Any]:
        report = {
            "dns_resolution": "success",
            "tcp_connection": "success",
            "authentication": "success",
            "status": "healthy",
            "latency_ms": 0
        }
        start = time.time()
        try:
            valid = await self.health_check()
            if not valid:
                report["status"] = "failed: file not found or path invalid"
                report["dns_resolution"] = "success"
                report["tcp_connection"] = "failed"
                report["authentication"] = "skipped"
            else:
                # Try loading a few records to confirm parseability
                records = await asyncio.to_thread(self._load_records, 5)
                if records == [] and self._path_valid():
                    report["status"] = "warning: file accessible but no records parsed"
        except Exception as e:
            report["status"] = f"failed: {str(e)}"
            report["tcp_connection"] = "failed"
        finally:
            report["latency_ms"] = int((time.time() - start) * 1000)
        return report

    async def disconnect(self):
        pass
