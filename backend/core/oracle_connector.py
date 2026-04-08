import time
import asyncio
from typing import List, Dict, Any, Optional
from core.base_connector import BaseConnector


def _oracledb_available() -> bool:
    try:
        import oracledb  # noqa: F401
        return True
    except ImportError:
        return False


class OracleConnector(BaseConnector):
    """Oracle Database connector using python-oracledb (thin mode).

    Thin mode requires no Oracle Instant Client — works out-of-box on Windows/Linux.
    Install:  pip install oracledb
    """

    @classmethod
    def get_config_schema(cls) -> Dict[str, Any]:
        return {
            "title": "Oracle Database Connection",
            "type": "object",
            "required": ["host", "port", "service_name", "username", "password"],
            "properties": {
                "host": {
                    "title": "Host",
                    "type": "string",
                    "placeholder": "oracle.company.com",
                    "description": "Hostname or IP of the Oracle server."
                },
                "port": {
                    "title": "Port",
                    "type": "integer",
                    "default": 1521,
                    "description": "Oracle listener port (default 1521)."
                },
                "service_name": {
                    "title": "Service Name",
                    "type": "string",
                    "placeholder": "ORCL",
                    "description": "Oracle service name (preferred over SID for modern deployments)."
                },
                "username": {
                    "title": "Username",
                    "type": "string",
                    "placeholder": "sys"
                },
                "password": {
                    "title": "Password",
                    "type": "string",
                    "format": "password"
                },
                "schema_name": {
                    "title": "Schema (optional)",
                    "type": "string",
                    "default": "",
                    "description": "Restrict schema discovery to this schema. Defaults to the connected user's schema."
                },
                "ssl_enabled": {
                    "title": "Use SSL/TLS",
                    "type": "boolean",
                    "default": False
                }
            }
        }

    @classmethod
    def get_capabilities(cls) -> Dict[str, Any]:
        return {
            "supports_cdc": False,
            "supports_incremental": True,
            "supports_parallel_reads": True,
            "supports_transactions": True,
            "max_connections": 10
        }

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.host: str = config.get("host", "")
        self.port: int = int(config.get("port", 1521))
        self.service_name: str = config.get("service_name", "")
        self.username: str = config.get("username", "")
        self.password: str = config.get("password", "")
        self.schema_name: str = config.get("schema_name", "") or self.username.upper()
        self._pool = None

    # ─────────────────────────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────────────────────────
    def _dsn(self) -> str:
        return f"{self.host}:{self.port}/{self.service_name}"

    async def _get_connection(self):
        if not _oracledb_available():
            raise RuntimeError("oracledb not installed. Run: pip install oracledb")
        import oracledb
        conn = await asyncio.to_thread(
            oracledb.connect,
            user=self.username,
            password=self.password,
            dsn=self._dsn()
        )
        return conn

    # ─────────────────────────────────────────────────────────────
    # BaseConnector interface
    # ─────────────────────────────────────────────────────────────
    async def connect(self) -> bool:
        if not _oracledb_available():
            return False
        try:
            conn = await asyncio.wait_for(self._get_connection(), timeout=10)
            await asyncio.to_thread(conn.close)
            return True
        except Exception:
            return False

    async def health_check(self) -> bool:
        if not _oracledb_available():
            return False
        try:
            conn = await asyncio.wait_for(self._get_connection(), timeout=8)
            cur = conn.cursor()
            await asyncio.to_thread(cur.execute, "SELECT 1 FROM DUAL")
            await asyncio.to_thread(cur.close)
            await asyncio.to_thread(conn.close)
            return True
        except Exception:
            return False

    async def _acquire_connection(self) -> Any:
        return await self._get_connection()

    async def _release_connection(self, conn: Any):
        try:
            await asyncio.to_thread(conn.close)
        except Exception:
            pass

    async def discover_schema(self) -> List[Dict[str, Any]]:
        if not _oracledb_available():
            return []
        try:
            conn = await asyncio.wait_for(self._get_connection(), timeout=15)

            def _query():
                cur = conn.cursor()
                schema = self.schema_name.upper()

                # Get tables
                cur.execute(
                    "SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER = :schema ORDER BY TABLE_NAME",
                    {"schema": schema}
                )
                tables_raw = [row[0] for row in cur.fetchall()]

                results = []
                for table in tables_raw:
                    cur.execute(
                        """SELECT COLUMN_NAME, DATA_TYPE, NULLABLE
                           FROM ALL_TAB_COLUMNS
                           WHERE OWNER = :schema AND TABLE_NAME = :table
                           ORDER BY COLUMN_ID""",
                        {"schema": schema, "table": table}
                    )
                    columns = [
                        {
                            "name": row[0],
                            "type": _map_oracle_type(row[1]),
                            "nullable": row[2] == "Y",
                            "is_primary_key": False
                        }
                        for row in cur.fetchall()
                    ]
                    # Row count estimate via statistics (fast)
                    cur.execute(
                        "SELECT NUM_ROWS FROM ALL_TABLES WHERE OWNER = :schema AND TABLE_NAME = :table",
                        {"schema": schema, "table": table}
                    )
                    row = cur.fetchone()
                    row_count = row[0] if row and row[0] is not None else 0

                    results.append({
                        "schema": schema,
                        "name": table,
                        "columns": columns,
                        "primary_key": None,
                        "row_count_estimate": row_count
                    })
                cur.close()
                conn.close()
                return results

            return await asyncio.to_thread(_query)
        except Exception as e:
            print(f"[OracleConnector] Schema discovery error: {e}")
            return []

    async def read_records(self, table_name: str, sync_mode: str, cursor: Optional[Any] = None) -> List[Dict[str, Any]]:
        try:
            conn = await asyncio.wait_for(self._get_connection(), timeout=30)

            def _fetch():
                cur = conn.cursor()
                schema = self.schema_name.upper()
                cur.execute(f'SELECT * FROM "{schema}"."{table_name}" FETCH FIRST 10000 ROWS ONLY')
                cols = [d[0].lower() for d in cur.description]
                rows = [dict(zip(cols, row)) for row in cur.fetchall()]
                cur.close()
                conn.close()
                return rows

            return await asyncio.to_thread(_fetch)
        except Exception:
            return []

    async def write_records(self, table_name: str, records: List[Dict[str, Any]]) -> bool:
        return False  # Destination writes out of scope for Phase 1

    async def read_chunked(self, table_name: str, chunk_size: int, partition_config: Optional[Dict[str, Any]] = None):
        all_rows = await self.read_records(table_name, "full_refresh")
        for i in range(0, len(all_rows), chunk_size):
            yield all_rows[i: i + chunk_size]

    async def discover_resources(self, target: str, **kwargs) -> List[Any]:
        if not _oracledb_available():
            return []
        try:
            conn = await asyncio.wait_for(self._get_connection(), timeout=10)

            def _fetch():
                cur = conn.cursor()
                if target == "databases" or target == "schemas":
                    cur.execute("SELECT DISTINCT OWNER FROM ALL_TABLES ORDER BY OWNER")
                    result = [row[0] for row in cur.fetchall()]
                elif target == "tables":
                    schema = kwargs.get("database_name", self.schema_name).upper()
                    cur.execute(
                        "SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER = :s ORDER BY TABLE_NAME",
                        {"s": schema}
                    )
                    result = [row[0] for row in cur.fetchall()]
                else:
                    result = []
                cur.close()
                conn.close()
                return result

            return await asyncio.to_thread(_fetch)
        except Exception:
            return []

    async def diagnose(self) -> Dict[str, Any]:
        report = {
            "dns_resolution": "success",
            "tcp_connection": "success",
            "authentication": "success",
            "status": "healthy",
            "latency_ms": 0
        }
        start = time.time()

        if not _oracledb_available():
            report["status"] = "failed: oracledb not installed — run: pip install oracledb"
            report["tcp_connection"] = "skipped"
            report["authentication"] = "skipped"
            report["latency_ms"] = 0
            return report

        try:
            # TCP reachability (socket check without Oracle handshake)
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            result = sock.connect_ex((self.host, self.port))
            sock.close()

            if result != 0:
                report["dns_resolution"] = "success"
                report["tcp_connection"] = f"failed: port {self.port} unreachable"
                report["authentication"] = "skipped"
                report["status"] = f"failed: cannot reach {self.host}:{self.port}"
                return report

            report["tcp_connection"] = "success"

            # Full Oracle connection
            ok = await asyncio.wait_for(self.health_check(), timeout=10)
            if not ok:
                report["authentication"] = "failed: credentials rejected or service_name invalid"
                report["status"] = "failed: authentication error"
            else:
                report["authentication"] = "success"
                report["status"] = "healthy"

        except asyncio.TimeoutError:
            report["status"] = "failed: connection timed out"
            report["tcp_connection"] = "failed"
        except Exception as e:
            report["status"] = f"failed: {str(e)}"
            report["tcp_connection"] = "failed"
        finally:
            report["latency_ms"] = int((time.time() - start) * 1000)

        return report

    async def disconnect(self):
        pass


def _map_oracle_type(oracle_type: str) -> str:
    t = oracle_type.upper()
    if "NUMBER" in t or "INTEGER" in t or "FLOAT" in t:
        return "number"
    if "CHAR" in t or "CLOB" in t or "VARCHAR" in t:
        return "string"
    if "DATE" in t or "TIMESTAMP" in t:
        return "timestamp"
    if "BLOB" in t or "RAW" in t:
        return "binary"
    return "string"
