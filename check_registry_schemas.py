import sys
import os
import json
# Add backend to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))
os.environ["USE_MOCK_DB"] = "true"

try:
    from core.connector_registry import ConnectorRegistry
    schemas = ConnectorRegistry.get_all_schemas()
    print("SCHEMAS_START")
    print(json.dumps(schemas, indent=2))
    print("SCHEMAS_END")
except Exception as e:
    print(f"FAILURE: {e}")
    import traceback
    traceback.print_exc()
