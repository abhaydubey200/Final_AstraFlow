from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
from services.connection_service import ConnectionService
from api.dependencies import get_connection_service
from core.connector_registry import ConnectorRegistry

router = APIRouter(prefix="/connections", tags=["connections"])

def _mask_connection(conn: dict) -> dict:
    """Remove sensitive fields from API response."""
    masked = dict(conn)
    masked.pop("password", None)
    if "config" in masked and isinstance(masked["config"], dict):
        config_copy = dict(masked["config"])
        config_copy.pop("password", None)
        masked["config"] = config_copy
    return masked

# --- Static / Metadata Routes ---
@router.get("/types")
async def get_connector_types():
    """Return all supported connector types and their configuration schemas."""
    schemas = ConnectorRegistry.get_all_schemas()
    return {"success": True, "data": schemas}

# --- Discovery & Testing (Unsaved Config) ---
@router.post("/test")
async def test_connection(
    config: Dict[str, Any],
    service: ConnectionService = Depends(get_connection_service)
):
    """Test a connection configuration before saving."""
    result = await service.test_connection(config)
    # test_connection already returns structured format, just add success wrapper
    if isinstance(result, dict) and "status" in result:
        result["success"] = result.get("status") == "success"
    return result

@router.post("/discover")
async def discover(
    config: Dict[str, Any],
    service: ConnectionService = Depends(get_connection_service)
):
    """Unified discovery endpoint for tables/schemas/files."""
    try:
        if config.get("target"):
            results = await service.discover_resources(config)
        else:
            results = await service.get_schema(config)
        return {"success": True, "data": results}
    except HTTPException as http_exc:
        # Re-raise HTTPExceptions with proper status codes
        raise http_exc
    except Exception as e:
        import logging
        logger = logging.getLogger("connection_router")
        logger.error(f"Discovery error: {str(e)}", exc_info=True)
        # Return detailed error information
        raise HTTPException(
            status_code=400,
            detail=f"Discovery failed: {str(e)}"
        )

@router.post("/preview-data")
async def preview_data(
    config: Dict[str, Any],
    service: ConnectionService = Depends(get_connection_service)
):
    """Preview data for a specific source/table."""
    try:
        data = await service.preview_data(config)
        return {"success": True, "data": data}
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger("connection_router")
        logger.error(f"Preview data error: {str(e)}", exc_info=True)
        return {"success": False, "error": str(e), "details": type(e).__name__}

# --- Collection Routes ---
@router.get("")
async def list_connections(
    limit: int = 50, 
    offset: int = 0,
    service: ConnectionService = Depends(get_connection_service)
):
    """List connections with pagination."""
    limit = min(limit, 100)
    connections = await service.list_connections(limit=limit, offset=offset)
    # Mask passwords in all connections
    masked_connections = [_mask_connection(c) for c in connections]
    return {"success": True, "data": masked_connections, "total": len(masked_connections)}

@router.post("")
async def create_connection(
    config: Dict[str, Any],
    service: ConnectionService = Depends(get_connection_service)
):
    """Create a new connection."""
    try:
        result = await service.create_connection(config)
        # Return full connection data (masked) instead of just ID
        masked = _mask_connection(result)
        return {"success": True, "data": masked, "message": "Connection created"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create connection: {str(e)}")

# --- Instance Specific Routes (Using IDs) ---
@router.get("/{connection_id}")
async def get_connection(
    connection_id: str,
    service: ConnectionService = Depends(get_connection_service)
):
    """Get connection details."""
    conn = await service.get_connection(connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    # Mask password before returning
    masked = _mask_connection(conn)
    return {"success": True, "data": masked}

@router.put("/{connection_id}")
async def update_connection(
    connection_id: str,
    config: Dict[str, Any],
    service: ConnectionService = Depends(get_connection_service)
):
    """Update an existing connection."""
    try:
        result = await service.update_connection(connection_id, config)
        return {"success": True, "data": {"id": connection_id}, "message": "Connection updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update connection: {str(e)}")

@router.delete("/{connection_id}")
async def delete_connection(
    connection_id: str,
    service: ConnectionService = Depends(get_connection_service)
):
    """Delete a connection."""
    await service.delete_connection(connection_id)
    return {"success": True, "message": "Connection deleted"}

@router.get("/{connection_id}/schema")
async def get_connection_schema(
    connection_id: str,
    service: ConnectionService = Depends(get_connection_service)
):
    """Discover schema for a stored connection."""
    conn = await service.get_connection(connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    try:
        schema = await service.get_schema(conn)
        return {"success": True, "data": schema}
    except Exception as e:
        return {"success": False, "error": str(e), "details": type(e).__name__}

@router.get("/{connection_id}/health")
async def check_connection_health(
    connection_id: str,
    service: ConnectionService = Depends(get_connection_service)
):
    """Check health of a stored connection."""
    conn_data = await service.get_connection(connection_id)
    if not conn_data:
        raise HTTPException(status_code=404, detail="Connection not found")
    conn_data["id"] = connection_id
    return await service.test_connection(conn_data)

@router.get("/{connection_id}/performance")
async def get_performance(
    connection_id: str,
    service: ConnectionService = Depends(get_connection_service)
):
    """Get performance metrics/capabilities."""
    return await service.capability_service.get_capabilities(connection_id)

