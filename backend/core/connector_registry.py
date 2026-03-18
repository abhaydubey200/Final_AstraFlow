from typing import Dict, Any, Type, List
from core.base_connector import BaseConnector
from core.postgres_connector import PostgresConnector
from core.snowflake_connector import SnowflakeConnector
from core.mssql_connector import MSSQLConnector
from core.mysql_connector import MySQLConnector

class ConnectorRegistry:
    _connectors: Dict[str, Type[BaseConnector]] = {
        "postgresql": PostgresConnector,
        "snowflake": SnowflakeConnector,
        "mssql": MSSQLConnector,
        "mysql": MySQLConnector
    }

    @classmethod
    def register(cls, name: str, connector_class: Type[BaseConnector]):
        cls._connectors[name] = connector_class

    @classmethod
    def get_connector_class(cls, name: str) -> Type[BaseConnector]:
        connector_class = cls._connectors.get(name.lower())
        if not connector_class:
            raise ValueError(f"Connector '{name}' not supported.")
        return connector_class

    @classmethod
    def get_supported_types(cls) -> List[str]:
        return list(cls._connectors.keys())

    @classmethod
    def get_all_schemas(cls) -> Dict[str, Any]:
        schemas = {}
        for name, connector_class in cls._connectors.items():
            try:
                schemas[name] = {
                    "schema": connector_class.get_config_schema(),
                    "capabilities": connector_class.get_capabilities()
                }
            except Exception as e:
                print(f"Error getting schema for {name}: {e}")
                schemas[name] = {"error": str(e)}
        return schemas
