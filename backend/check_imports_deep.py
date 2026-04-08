import os
import sys
import traceback
import importlib

# Add the current directory to sys.path
sys.path.append(os.getcwd())

modules_to_test = [
    'api.dependencies',
    'api.pipeline_router',
    'api.connection_router',
    'api.monitoring_router',
    'api.self_healing_router',
    'api.metadata_router',
    'api.catalog_router',
    'core.error_handler',
    'core.data_utils',
    'core.database',
    'core.connector_registry'
]

for mod in modules_to_test:
    try:
        print(f"Testing {mod}...")
        importlib.import_module(mod)
        print(f"✅ SUCCESS: {mod} imported successfully")
    except Exception:
        print(f"❌ ERROR: {mod} failed to import")
        traceback.print_exc()
        print("-" * 40)
