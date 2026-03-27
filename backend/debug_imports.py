import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

modules = [
    "core.supabase_client",
    "core.decorators",
    "core.database",
    "core.error_handler",
    "core.data_utils",
    "api.pipeline_router",
    "api.connection_router",
    "api.monitoring_router",
    "api.cost_router",
    "api.metadata_router",
    "api.self_healing_router",
    "services.canary_service",
    "services.auto_heal_service",
    "services.self_healing_service",
    "services.scheduler_service",
    "services.worker_service"
]

for mod in modules:
    print(f"Importing {mod}...", end=" ")
    try:
        __import__(mod)
        print("SUCCESS")
    except Exception as e:
        print(f"FAILED: {e}")
        import traceback
        traceback.print_exc()
        # sys.exit(1) # Continue to see other failures

print("\nImport test finished.")
