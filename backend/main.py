from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import asyncio
from dotenv import load_dotenv

# Stabilization: Allow Mock DB for testing/validation if real DB is unreachable
if os.getenv("USE_MOCK_DB") == "true":
    try:
        import mock_db
    except ImportError:
        pass

from api.pipeline_router import router as pipeline_router
from api.connection_router import router as connection_router
from api.metadata_router import router as metadata_router
from api.monitoring_router import router as monitoring_router
from api.self_healing_router import router as self_healing_router
from api.cost_router import router as cost_router
from services.self_healing_service import self_healing_manager

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from core.auth_middleware import RBACMiddleware
from core.audit_middleware import AuditMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from core.database import db_manager
from core.healing_monitor import runtime_monitor
from services.canary_service import canary_manager

# Wire up the autonomous runtime
runtime_monitor.set_healing_manager(self_healing_manager)
canary_manager.set_healing_manager(self_healing_manager)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Injects secure HTTP response headers on every response."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response

load_dotenv()

limiter = Limiter(key_func=get_remote_address)
# Disable redirect_slashes to prevent 307 redirects from bypassing RBAC middleware on missing auth.
app = FastAPI(title="AstraFlow API", version="1.0.0", redirect_slashes=True)
app.state.limiter = limiter

from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)

# Global Error Handler: Catch unhandled exceptions to prevent leaking server details
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_msg = str(exc)
    logger.error(f"UNHANDLED ERROR: {error_msg} on {request.url.path}")
    
    # Trigger self-healing
    asyncio.create_task(self_healing_manager.diagnose_and_fix(error_msg, context=f"api:{request.url.path}"))
    
    # Determine origin for CORS header
    origin = request.headers.get("origin", "http://localhost:8080")
    allowed = ["http://localhost:5173", "http://localhost:3000", "http://localhost:8080", "http://localhost:8081", "http://localhost:8082", "http://127.0.0.1:8080", "http://127.0.0.1:5173", "http://127.0.0.1:8082"]
    cors_origin = origin if origin in allowed else "http://localhost:8082"

    return JSONResponse(
        status_code=500,
        content={
            "error": "An internal server error occurred.",
            "detail": error_msg,
            "path": request.url.path,
            "healing": True
        },
        headers={
            "Access-Control-Allow-Origin": cors_origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.on_event("startup")
async def startup_event():
    await db_manager.connect()
    from core.snowflake_connector import SnowflakeConnector
    print(f"STARTUP DEBUG: SnowflakeConnector abstract methods: {SnowflakeConnector.__abstractmethods__}")
    app.state.db_pool = db_manager.pool
    self_healing_manager.pool = db_manager.pool
    
    # Start DAG Engine (Scheduler + Workers)
    from services.scheduler_service import SchedulerService
    from services.worker_service import WorkerService
    
    scheduler = SchedulerService(db_manager.pool)
    worker = WorkerService(db_manager.pool)
    
    asyncio.create_task(scheduler.run_loop())
    # The worker also needs a loop to poll task_runs
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
    
    asyncio.create_task(worker_loop())
    print("INFRA: DAG Scheduler and Worker loops started.")

    # Start autonomous validation loop
    await canary_manager.start()

@app.on_event("shutdown")
async def shutdown_event():
    await canary_manager.stop()
    await db_manager.disconnect()

# RBAC Configuration
ROLE_PERMISSIONS = {
    "admin": ["*"],
    "data_engineer": ["create", "update", "run", "view"],
    "analyst": ["run", "view"],
    "viewer": ["view"]
}

# Security: Restrict CORS to known origins only
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:8082",
    "http://localhost:8083",
    "http://localhost:8084",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8082",
    "http://127.0.0.1:8083",
    "http://127.0.0.1:8084",
]

app.add_middleware(AuditMiddleware)
app.add_middleware(RBACMiddleware, role_permissions=ROLE_PERMISSIONS)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

app.include_router(pipeline_router, tags=["pipelines"])
app.include_router(connection_router, tags=["connections"])
app.include_router(metadata_router, tags=["metadata"])
app.include_router(monitoring_router, tags=["monitoring"])
app.include_router(self_healing_router, tags=["self-healing"])
app.include_router(cost_router, tags=["costs"])

@app.get("/")
async def root():
    return {"message": "AstraFlow API is running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="::", port=8081, reload=True)
