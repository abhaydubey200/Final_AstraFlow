from fastapi import Request, status, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
import logging
import traceback
from datetime import datetime
import uuid
import asyncio
import os

logger = logging.getLogger(__name__)

# Custom Exception Classes
class DatabaseError(Exception):
    """Raised when database operations fail."""
    pass


class ConnectionError(Exception):
    """Raised when external connection fails."""
    pass


class AuthenticationError(Exception):
    """Raised when authentication fails."""
    pass


class ResourceNotFoundError(Exception):
    """Raised when a requested resource is not found."""
    pass


# Exception Handlers
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors."""
    error_id = str(uuid.uuid4())
    logger.warning(
        f"Validation Error [ID: {error_id}]: {exc.errors()}\n"
        f"Path: {request.url.path}\n"
        f"Body: {exc.body if hasattr(exc, 'body') else 'N/A'}"
    )
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error_id": error_id,
            "error_code": "VALIDATION_ERROR",
            "message": "Request validation failed",
            "details": exc.errors(),
            "timestamp": datetime.utcnow().isoformat(),
            "path": request.url.path,
        }
    )


async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle FastAPI HTTP exceptions."""
    error_id = str(uuid.uuid4())
    logger.warning(
        f"HTTP Exception [ID: {error_id}]: {exc.status_code} - {exc.detail}\n"
        f"Path: {request.url.path}"
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_id": error_id,
            "error_code": f"HTTP_{exc.status_code}",
            "message": exc.detail,
            "timestamp": datetime.utcnow().isoformat(),
            "path": request.url.path,
        }
    )


async def database_exception_handler(request: Request, exc: DatabaseError):
    """Handle database-specific errors."""
    error_id = str(uuid.uuid4())
    logger.error(
        f"Database Error [ID: {error_id}]: {str(exc)}\n"
        f"Path: {request.url.path}",
        exc_info=True
    )
    
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "error_id": error_id,
            "error_code": "DATABASE_ERROR",
            "message": "Database operation failed. Please try again later.",
            "timestamp": datetime.utcnow().isoformat(),
            "path": request.url.path,
        }
    )


async def resource_not_found_handler(request: Request, exc: ResourceNotFoundError):
    """Handle resource not found errors."""
    error_id = str(uuid.uuid4())
    logger.info(
        f"Resource Not Found [ID: {error_id}]: {str(exc)}\n"
        f"Path: {request.url.path}"
    )
    
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "error_id": error_id,
            "error_code": "NOT_FOUND",
            "message": str(exc) or "Resource not found",
            "timestamp": datetime.utcnow().isoformat(),
            "path": request.url.path,
        }
    )


async def authentication_exception_handler(request: Request, exc: AuthenticationError):
    """Handle authentication errors."""
    error_id = str(uuid.uuid4())
    logger.warning(
        f"Authentication Error [ID: {error_id}]: {str(exc)}\n"
        f"Path: {request.url.path}"
    )
    
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={
            "error_id": error_id,
            "error_code": "AUTHENTICATION_ERROR",
            "message": "Authentication failed",
            "timestamp": datetime.utcnow().isoformat(),
            "path": request.url.path,
        },
        headers={"WWW-Authenticate": "Bearer"}
    )


async def global_exception_handler(request: Request, exc: Exception):
    """Handle all other unexpected exceptions."""
    error_id = str(uuid.uuid4())
    
    # Trigger self-healing if available
    try:
        from services.self_healing_service import self_healing_manager
        asyncio.create_task(self_healing_manager.diagnose_and_fix(str(exc), context=f"api:{request.url.path}"))
    except ImportError:
        pass
    
    # Log full traceback for debugging
    logger.error(
        f"Unhandled Exception [ID: {error_id}]: {str(exc)}\n"
        f"Path: {request.url.path}\n"
        f"Type: {type(exc).__name__}\n"
        f"{traceback.format_exc()}"
    )
    
    # Determine origin for CORS header
    origin = request.headers.get("origin", "http://localhost:8082")
    allowed = [
        "http://localhost:5173", "http://localhost:3000", "http://localhost:8080",
        "http://localhost:8081", "http://localhost:8082", "http://127.0.0.1:8080",
        "http://127.0.0.1:5173", "http://127.0.0.1:8082"
    ]
    cors_origin = origin if origin in allowed else "http://localhost:8082"
    
    # In development, return detailed error; in production, generic message
    is_dev = os.getenv("ENVIRONMENT", "development") == "development"
    
    content = {
        "error_id": error_id,
        "error_code": "INTERNAL_SERVER_ERROR",
        "message": "An unexpected error occurred. Our systems have been notified.",
        "timestamp": datetime.utcnow().isoformat(),
        "path": request.url.path,
        "healing": True
    }
    
    if is_dev:
        content["details"] = {
            "type": type(exc).__name__,
            "message": str(exc),
            "traceback": traceback.format_exc().split('\n')
        }

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=content,
        headers={
            "Access-Control-Allow-Origin": cors_origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )


def setup_exception_handlers(app):
    """
    Register all exception handlers with the FastAPI app.
    
    Handlers are registered in order of specificity (most specific first).
    """
    # Specific exception handlers
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(ValidationError, validation_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(DatabaseError, database_exception_handler)
    app.add_exception_handler(ResourceNotFoundError, resource_not_found_handler)
    app.add_exception_handler(AuthenticationError, authentication_exception_handler)
    
    # Catch-all handler (must be last)
    app.add_exception_handler(Exception, global_exception_handler)
    
    logger.info("✅ Exception handlers registered successfully")
