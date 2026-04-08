import os
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.error_handler import setup_exception_handlers
from core.data_utils import limiter

# Import routers
from api.pipeline_router import router as pipeline_router
from api.connection_router import router as connection_router
from api.monitoring_router import router as monitoring_router
from api.self_healing_router import router as self_healing_router
from api.metadata_router import router as metadata_router
from api.catalog_router import router as catalog_router

# Optional services - don't block if missing
try:
    from core.database import db_manager
except ImportError:
    db_manager = None
    
print("[OK] AstraFlow Backend - SIMPLE MODE (No blocking dependencies)")

app = FastAPI(
    title="AstraFlow API", 
    version="3.0.0-stable",
    description="Production ETL Platform - Single Admin Mode"
)
app.state.limiter = limiter
app.state.db_pool = None
app.state.current_user = {
    "id": "admin-001",
    "email": "dubeyabhay430@gmail.com",
    "name": "Abhay Dubey",
    "role": "SUPER_ADMIN"
}

# CORS Configuration - Restrict origins based on environment
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000,http://localhost:8080").split(",")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# In production, NEVER use wildcard origins
if ENVIRONMENT == "production" and "*" in ALLOWED_ORIGINS:
    raise ValueError("CORS wildcard (*) is not allowed in production. Set ALLOWED_ORIGINS environment variable.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
    max_age=600,  # Cache preflight requests for 10 minutes
)

# Register Centralized Global Exception Handler
try:
    setup_exception_handlers(app)
except Exception as e:
    print(f"Warning: Could not setup exception handlers: {e}")

@app.on_event("startup")
async def startup_event():
    """Non-blocking startup - degraded mode if dependencies fail"""
    print("[START] AstraFlow Starting (Degraded Mode Enabled)...")
    
    # Try to connect DB but don't block
    if db_manager:
        try:
            await db_manager.connect()
            print("[OK] Database connected")
        except Exception as e:
            print(f"[WARN] Database unavailable (degraded mode): {e}")
    
    print("[OK] Backend ready on port 8000")

@app.on_event("shutdown")
async def shutdown_event():
    if db_manager:
        try:
            await db_manager.disconnect()
        except:
            pass

# Health Check
@app.get("/health")
async def health():
    """Simple health check - no external dependencies"""
    return {
        "status": "online",
        "version": "3.0.0-stable",
        "mode": "single-admin",
        "user": "dubeyabhay430@gmail.com"
    }

# Register Routers (only if they exist)
if pipeline_router:
    app.include_router(pipeline_router, tags=["pipelines"])
if connection_router:
    app.include_router(connection_router, tags=["connections"])
if monitoring_router:
    app.include_router(monitoring_router, tags=["monitoring"])
if self_healing_router:
    app.include_router(self_healing_router, tags=["self-healing"])
if metadata_router:
    app.include_router(metadata_router, tags=["metadata"])
if catalog_router:
    app.include_router(catalog_router, tags=["catalog"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
