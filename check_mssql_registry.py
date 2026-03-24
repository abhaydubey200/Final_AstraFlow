import sys
import os
import json
# Add backend to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))
os.environ["USE_MOCK_DB"] = "true"

try:
    from core.connector_registry import ConnectorRegistry
    schemas = ConnectorRegistry.get_all_schemas()
    print("KEYS:", list(schemas.keys()))
    if "mssql" in schemas:
        print("MSSQL_SCHEMA:", json.dumps(schemas["mssql"], indent=2))
    else:
        print("MSSQL MISSING FROM REGISTRY")
except Exception as e:
    print(f"FAILURE: {e}")
