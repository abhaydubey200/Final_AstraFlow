import os
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

class BaseConnector(ABC):
    def _is_mock(self) -> bool:
        """Returns True if mock mode is enabled for this connection."""
        host = (self.config.get("host") or "").lower()
        if "mock" in host or "demo" in host:
            return True
        return os.getenv("USE_MOCK_DB") == "true" and os.getenv("REAL_EXTERNAL_CONNECTORS") != "true"

    def _should_fail_dns(self) -> bool:
        """Simulate DNS failure for specific test hosts in mock mode."""
        host = (self.config.get("host") or "").lower()
        return "non-existent" in host or "invalid-host" in host

    def _should_fail_tcp(self) -> bool:
        """Simulate TCP failure for specific test hosts/ports in mock mode."""
        host = (self.config.get("host") or "").lower()
        port = int(self.config.get("port") or 0)
        return "unreachable" in host or port == 9999 or "non-existent" in host

    def __init__(self, config: Dict[str, Any]):
        self.config = self.normalize_config(config)
        self._pool = None

    @classmethod
    def normalize_config(cls, config: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize common database connection parameters."""
        # Avoid calling abstract get_config_schema on the base class
        # Subclasses can override this if they need specific defaults
        port = config.get("port")
        try:
            if port is not None and str(port).strip():
                port = int(port)
            else:
                port = 0
        except (ValueError, TypeError):
            port = 0

        return {
            "host": config.get("host"),
            "port": port,
            "database": config.get("database") or config.get("database_name"),
            "username": config.get("username") or config.get("user"),
            "password": config.get("password"),
            "ssl_enabled": config.get("ssl_enabled") or config.get("ssl", False),
            "warehouse": config.get("warehouse") or config.get("warehouse_name"),
            "schema": config.get("schema") or config.get("schema_name"),
            "security_level": config.get("security_level", "standard")
        }

    @abstractmethod
    async def connect(self) -> bool:
        """Establish connection to the data source/destination."""
        raise NotImplementedError()

    @asynccontextmanager
    async def connection(self):
        """Asynchronous context manager to acquire and return a connection from the pool."""
        conn = await self._acquire_connection()
        try:
            yield conn
        finally:
            await self._release_connection(conn)

    @abstractmethod
    async def _acquire_connection(self) -> Any:
        """Internal method to acquire a raw connection from the pool."""
        raise NotImplementedError()

    @abstractmethod
    async def _release_connection(self, conn: Any):
        """Internal method to release a raw connection back to the pool."""
        raise NotImplementedError()

    @abstractmethod
    async def health_check(self) -> bool:
        """Verify the connection is healthy."""
        raise NotImplementedError()

    @abstractmethod
    async def discover_schema(self) -> List[Dict[str, Any]]:
        """Discover the schema of the source system (tables, columns, types)."""
        raise NotImplementedError()

    @abstractmethod
    async def read_records(self, table_name: str, sync_mode: str, cursor: Optional[Any] = None) -> List[Dict[str, Any]]:
        """Read records from the source system."""
        raise NotImplementedError()

    @abstractmethod
    async def write_records(self, table_name: str, records: List[Dict[str, Any]]) -> bool:
        """Write records to the destination system."""
        raise NotImplementedError()

    @abstractmethod
    async def read_chunked(self, table_name: str, chunk_size: int, partition_config: Optional[Dict[str, Any]] = None):
        """Yields chunks of records from the source system."""
        raise NotImplementedError()

    @classmethod
    @abstractmethod
    def get_config_schema(cls) -> Dict[str, Any]:
        """Return the JSON schema for this connector's configuration."""
        raise NotImplementedError()

    @classmethod
    @abstractmethod
    def get_capabilities(cls) -> Dict[str, Any]:
        """Return the capabilities of this connector (e.g., CDC, incremental)."""
        raise NotImplementedError()

    @abstractmethod
    async def diagnose(self) -> Dict[str, Any]:
        """Perform deep diagnostics and return a structured report."""
        raise NotImplementedError()
    
    @abstractmethod
    async def discover_resources(self, target: str, **kwargs) -> List[Any]:
        """Discover resources like databases, schemas, or tables with optional context."""
        raise NotImplementedError()

    @abstractmethod
    async def disconnect(self):
        """Close the connection and the pool."""
        pass
