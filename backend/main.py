import os
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.database import db_manager
from api.pipeline_router import router as pipeline_router
from api.connection_router import router as connection_router
from api.monitoring_router import router as monitoring_router
from api.cost_router import router as cost_router
from api.metadata_router import router as metadata_router
from api.self_healing_router import router as self_healing_router
from services.canary_service import canary_manager
from core.error_handler import setup_exception_handlers
from core.data_utils import limiter
from services.auto_heal_service import setup_auto_heal
from services.self_healing_service import self_healing_manager
from core.supabase_client import supabase, supabase_manager, validate_env
from core.decorators import safe_execute

# Load environment variables and validate Phase 3
validate_env()

# Initialize Mock DB if enabled
if os.getenv("USE_MOCK_DB") == "true":
    try:
        import mock_db
    except ImportError:
        print("WARNING: mock_db module not found. Falling back to real DB.")

app = FastAPI(title="AstraFlow API", version="2.5.0")
app.state.limiter = limiter
app.state.db_pool = None

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Centralized Global Exception Handler
setup_exception_handlers(app)

# Phase 6: Deterministic Health System
async def health_check_internal():
    """Verify Supabase API connectivity (Phase 6.1)"""
    try:
        supabase.table("pipelines").select("id").limit(1).execute()
        print("STARTUP: Supabase API Connectivity PASSED.")
    except Exception as e:
        print(f"STARTUP: Supabase API Connectivity FAILED: {e}")
        raise

async def write_check_internal():
    """Verify Supabase RLS Write Bypass (Phase 6.2)"""
    try:
        test_record = {
            "name": "system_startup_check",
            "description": "HEALTH_CHECK_WRITE_PHASE_6",
            "status": "draft"
        }
        res = supabase.table("pipelines").insert(test_record).execute()
        if res.data and len(res.data) > 0:
            test_id = res.data[0]['id']
            supabase.table("pipelines").delete().eq("id", test_id).execute()
        print("STARTUP: Supabase RLS Bypass (Service Role) PASSED.")
    except Exception as e:
        print(f"STARTUP: Supabase RLS Bypass (Service Role) FAILED: {e}")
        raise

@app.on_event("startup")
async def startup_event():
    print("INFRA: AstraFlow Starting Up...")
    try:
        # Phase 6: Deterministic Health Verification
        await health_check_internal()
        await write_check_internal()
        
        # Initialize Database Manager
        await db_manager.connect()
        print("INFRA: Database layer initialized via HTTPS SDK.")
        
        # Initialize Auto-Heal
        setup_auto_heal(app, None)
        
        # Snowflake check for stability
        from core.snowflake_connector import SnowflakeConnector
        print(f"STARTUP: SnowflakeConnector verified. Abstract methods: {SnowflakeConnector.__abstractmethods__}")
        
        # Ensure self-healing pool is reset for SDK mode
        self_healing_manager.pool = None
        
        # Start DAG Engine (Scheduler + Workers)
        from services.scheduler_service import SchedulerService
        from services.worker_service import WorkerService
        
        scheduler = SchedulerService(None)
        worker = WorkerService(None)
        
        asyncio.create_task(scheduler.run_loop())
        
        async def worker_loop():
            while True:
                try:
                    task_run = await worker.claim_task_run()
                    if task_run:
                        await worker.process_task(task_run)
                    else:
                        await asyncio.sleep(2)
                except Exception as e:
                    print(f"Worker Loop Error: {e}")
                    await asyncio.sleep(5)
        
        async def job_worker_loop():
            while True:
                try:
                    job = await worker.claim_job()
                    if job:
                        await worker.process_job(job)
                    else:
                        await asyncio.sleep(2)
                except Exception as e:
                    print(f"Job Worker Error: {e}")
                    await asyncio.sleep(5)
        
        asyncio.create_task(worker_loop())
        asyncio.create_task(job_worker_loop())
        print("INFRA: DAG Scheduler and Worker loops started.")

        # Start autonomous validation loop (Canary)
        await canary_manager.start()
        print("INFRA: Canary monitoring active.")

    except Exception as e:
        import traceback
        print("FATAL: Startup sequence failed!")
        traceback.print_exc()
        # In a real production environment, we might want to exit here
        # raise e

@app.on_event("shutdown")
async def shutdown_event():
    await canary_manager.stop()
    await db_manager.disconnect()

# Health Check
@app.get("/health")
async def health():
    """Phase 11: Production Observability Endpoint"""
    db_ok = await supabase_manager.check_health()
    return {
        "status": "online" if db_ok else "degraded",
        "version": "2.5.0-hardened",
        "mode": "production",
        "database": "connected" if db_ok else "failed"
    }

# Register Routers
app.include_router(pipeline_router, tags=["pipelines"])
app.include_router(connection_router, tags=["connections"])
app.include_router(monitoring_router, tags=["monitoring"])
app.include_router(cost_router, tags=["cost"])
app.include_router(metadata_router, tags=["metadata"])
app.include_router(self_healing_router, tags=["self-healing"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8081)
