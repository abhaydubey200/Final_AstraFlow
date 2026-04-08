import os
import sys

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
    'services.pipeline_service',
    'services.worker_service',
    'services.connection_service',
    'services.analytics_service',
    'services.ai_insight_service',
    'services.validation_service',
    'services.lineage_service',
    'services.metadata_service',
    'core.database',
    'core.connector_registry'
]

for mod in modules_to_test:
    try:
        __import__(mod)
        print(f"SUCCESS: {mod} imported successfully")
    except ImportError as e:
        print(f"ERROR: {mod} failed to import: {e}")
    except Exception as e:
        print(f"EXCEPTION: {mod} failed with error: {e}")
