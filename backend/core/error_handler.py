from fastapi import Request, status
from fastapi.responses import JSONResponse
import logging
import traceback
from datetime import datetime
import uuid
import asyncio

logger = logging.getLogger(__name__)

async def global_exception_handler(request: Request, exc: Exception):
    error_id = str(uuid.uuid4())
    error_msg = str(exc)
    
    # Trigger self-healing if available
    try:
        from services.self_healing_service import self_healing_manager
        asyncio.create_task(self_healing_manager.diagnose_and_fix(error_msg, context=f"api:{request.url.path}"))
    except ImportError:
        pass
    
    logger.error(
        f"Unhandled Exception [ID: {error_id}]: {error_msg}\n"
        f"Path: {request.url.path}\n"
        f"{traceback.format_exc()}"
    )
    
    # Determine origin for CORS header
    origin = request.headers.get("origin", "http://localhost:8080")
    allowed = ["http://localhost:5173", "http://localhost:3000", "http://localhost:8080", "http://localhost:8081", "http://localhost:8082", "http://127.0.0.1:8080", "http://127.0.0.1:5173", "http://127.0.0.1:8082"]
    cors_origin = origin if origin in allowed else "http://localhost:8082"

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error_id": error_id,
            "error_code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred. Our self-healing systems have been notified.",
            "timestamp": datetime.utcnow().isoformat(),
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

def setup_exception_handlers(app):
    app.add_exception_handler(Exception, global_exception_handler)
