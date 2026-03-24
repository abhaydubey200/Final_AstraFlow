import sys
import os
import json
# Add backend to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))
os.environ["USE_MOCK_DB"] = "true"

try:
    from core.connector_registry import ConnectorRegistry
    schemas = ConnectorRegistry.get_all_schemas()
    if "mssql" in schemas:
        print("MSSQL_DATA_START")
        print(json.dumps(schemas["mssql"], indent=2))
        print("MSSQL_DATA_END")
    else:
        print("MSSQL MISSING")
except Exception as e:
    print(f"FAILURE: {e}")
