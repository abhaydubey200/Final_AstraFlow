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
from services.auto_heal_service import setup_auto_heal
from services.self_healing_service import self_healing_manager
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Mock DB if enabled
if os.getenv("USE_MOCK_DB") == "true":
    try:
        import mock_db
    except ImportError:
        print("WARNING: mock_db module not found. Falling back to real DB.")

app = FastAPI(title="AstraFlow API", version="2.5.0")

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

@app.on_event("startup")
async def startup_event():
    try:
        await db_manager.connect()
        setup_auto_heal(app, db_manager.pool)
        
        # Snowflake check for stability
        from core.snowflake_connector import SnowflakeConnector
        print(f"STARTUP: SnowflakeConnector verified. Abstract methods: {SnowflakeConnector.__abstractmethods__}")
        
        app.state.db_pool = db_manager.pool
        self_healing_manager.pool = db_manager.pool
        
        # Start DAG Engine (Scheduler + Workers)
        from services.scheduler_service import SchedulerService
        from services.worker_service import WorkerService
        
        scheduler = SchedulerService(db_manager.pool)
        worker = WorkerService(db_manager.pool)
        
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

        # Start autonomous validation loop
        await canary_manager.start()
    except Exception as e:
        import traceback
        print(f"CRITICAL STARTUP ERROR: {e}")
        print(traceback.format_exc())

@app.on_event("shutdown")
async def shutdown_event():
    await canary_manager.stop()
    await db_manager.disconnect()

# Health Check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "mode": "mock" if os.getenv("USE_MOCK_DB") == "true" else "production"}

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
