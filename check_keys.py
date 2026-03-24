import sys
import os
# Add backend to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))
os.environ["USE_MOCK_DB"] = "true"

try:
    from core.connector_registry import ConnectorRegistry
    schemas = ConnectorRegistry.get_all_schemas()
    print("KEYS_START")
    for k in schemas.keys():
        print(f"KEY: {k}")
    print("KEYS_END")
except Exception as e:
    print(f"FAILURE: {e}")
