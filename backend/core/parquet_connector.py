import os
import time
import asyncio
from typing import List, Dict, Any, Optional
from core.base_connector import BaseConnector


def _pyarrow_available() -> bool:
    try:
        import pyarrow  # noqa: F401
        return True
    except ImportError:
        return False


def _pandas_available() -> bool:
    try:
        import pandas  # noqa: F401
        return True
    except ImportError:
        return False


class ParquetConnector(BaseConnector):
    """Connector for Apache Parquet files.

    Tries pyarrow first; falls back to pandas.fastparquet.
    Neither is required at import time — failures are caught gracefully.
    """

    @classmethod
    def get_config_schema(cls) -> Dict[str, Any]:
        return {
            "title": "Parquet File Connection",
            "type": "object",
            "required": ["path"],
            "properties": {
                "path": {
                    "title": "File Path",
                    "type": "string",
                    "placeholder": "C:/data/events.parquet",
                    "description": "Full local path to the .parquet file."
                },
                "row_group_size": {
                    "title": "Row Group Size (streaming)",
                    "type": "integer",
                    "default": 10000,
                    "description": "Number of rows per chunk when streaming data."
                }
            }
        }

    @classmethod
    def get_capabilities(cls) -> Dict[str, Any]:
        return {
            "supports_cdc": False,
            "supports_incremental": False,
            "supports_parallel_reads": True,
            "supports_transactions": False,
            "max_connections": 1
        }

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.path: str = config.get("path", "")
        self.row_group_size: int = int(config.get("row_group_size", 10_000))

    # ─────────────────────────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────────────────────────
    def _path_valid(self) -> bool:
        return bool(self.path) and os.path.isfile(self.path)

    def _read_schema_sync(self) -> List[Dict[str, Any]]:
        """Return column info without reading all data (uses file metadata)."""
        if _pyarrow_available():
            import pyarrow.parquet as pq
            schema = pq.read_schema(self.path)
            columns = []
            for field in schema:
                pa_type = str(field.type)
                if "int" in pa_type:
                    dtype = "integer"
                elif "float" in pa_type or "double" in pa_type:
                    dtype = "float"
                elif "bool" in pa_type:
                    dtype = "boolean"
                elif "timestamp" in pa_type or "date" in pa_type:
                    dtype = "timestamp"
                else:
                    dtype = "string"
                columns.append({
                    "name": field.name,
                    "type": dtype,
                    "nullable": field.nullable,
                    "is_primary_key": False
                })
            meta = pq.read_metadata(self.path)
            row_count = meta.num_rows
            return columns, row_count

        elif _pandas_available():
            import pandas as pd
            df = pd.read_parquet(self.path).head(0)  # schema only
            columns = []
            for col, dtype in df.dtypes.items():
                ds = str(dtype)
                if "int" in ds:
                    mapped = "integer"
                elif "float" in ds:
                    mapped = "float"
                elif "bool" in ds:
                    mapped = "boolean"
                elif "datetime" in ds:
                    mapped = "timestamp"
                else:
                    mapped = "string"
                columns.append({"name": str(col), "type": mapped, "nullable": True, "is_primary_key": False})
            # Row count estimation: read without data
            total = len(pd.read_parquet(self.path))
            return columns, total
        else:
            raise RuntimeError("Neither pyarrow nor pandas is installed. Run: pip install pyarrow")

    def _read_rows_sync(self, max_rows: int = 10_000) -> List[Dict[str, Any]]:
        if _pyarrow_available():
            import pyarrow.parquet as pq
            table = pq.read_table(self.path)
            df = table.to_pandas().head(max_rows)
            return df.to_dict(orient="records")
        elif _pandas_available():
            import pandas as pd
            df = pd.read_parquet(self.path).head(max_rows)
            return df.to_dict(orient="records")
        return []

    # ─────────────────────────────────────────────────────────────
    # BaseConnector interface
    # ─────────────────────────────────────────────────────────────
    async def connect(self) -> bool:
        if not self._path_valid():
            return False
        if not _pyarrow_available() and not _pandas_available():
            return False
        return True

    async def health_check(self) -> bool:
        return self._path_valid() and (_pyarrow_available() or _pandas_available())

    async def _acquire_connection(self) -> Any:
        return self.path

    async def _release_connection(self, conn: Any):
        pass

    async def discover_schema(self) -> List[Dict[str, Any]]:
        if not self._path_valid():
            return []
        try:
            columns, row_count = await asyncio.to_thread(self._read_schema_sync)
            return [{
                "schema": "local",
                "name": os.path.basename(self.path),
                "columns": columns,
                "primary_key": None,
                "row_count_estimate": row_count
            }]
        except Exception as e:
            print(f"[ParquetConnector] Schema discovery error: {e}")
            return []

    async def read_records(self, table_name: str, sync_mode: str, cursor: Optional[Any] = None) -> List[Dict[str, Any]]:
        try:
            return await asyncio.to_thread(self._read_rows_sync, 10_000)
        except Exception:
            return []

    async def write_records(self, table_name: str, records: List[Dict[str, Any]]) -> bool:
        return False

    async def read_chunked(self, table_name: str, chunk_size: int, partition_config: Optional[Dict[str, Any]] = None):
        try:
            if _pyarrow_available():
                import pyarrow.parquet as pq

                def _iter():
                    pf = pq.ParquetFile(self.path)
                    for batch in pf.iter_batches(batch_size=chunk_size):
                        yield batch.to_pydict()

                for batch_dict in await asyncio.to_thread(list, _iter()):
                    # Convert column-oriented dict → row-oriented list
                    keys = list(batch_dict.keys())
                    n = len(batch_dict[keys[0]]) if keys else 0
                    yield [{k: batch_dict[k][i] for k in keys} for i in range(n)]
            else:
                all_rows = await asyncio.to_thread(self._read_rows_sync, 50_000)
                for i in range(0, len(all_rows), chunk_size):
                    yield all_rows[i: i + chunk_size]
        except Exception:
            return

    async def discover_resources(self, target: str, **kwargs) -> List[Any]:
        return [os.path.basename(self.path)]

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
            if not self._path_valid():
                report["status"] = "failed: file not found"
                report["tcp_connection"] = "failed"
            elif not _pyarrow_available() and not _pandas_available():
                report["status"] = "failed: no parquet library installed (pip install pyarrow)"
                report["authentication"] = "skipped"
            else:
                # Lightweight schema read to confirm file is valid parquet
                await asyncio.to_thread(self._read_schema_sync)
        except Exception as e:
            report["status"] = f"failed: {str(e)}"
            report["tcp_connection"] = "failed"
        finally:
            report["latency_ms"] = int((time.time() - start) * 1000)
        return report

    async def disconnect(self):
        pass
