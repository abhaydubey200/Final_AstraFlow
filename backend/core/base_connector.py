from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class BaseConnector(ABC):
    def __init__(self, config: Dict[str, Any]):
        self.config = self.normalize_config(config)

    @classmethod
    def normalize_config(cls, config: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize common database connection parameters."""
        return {
            "host": config.get("host"),
            "port": int(config.get("port") or 0) or cls.get_config_schema().get("properties", {}).get("port", {}).get("default", 0),
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
    async def disconnect(self):
        """Close the connection."""
        pass
