from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
from services.connection_service import ConnectionService
from api.dependencies import get_connection_service
from core.connector_registry import ConnectorRegistry

router = APIRouter(prefix="/connections", tags=["connections"])

@router.get("/types")
async def get_connector_types():
    """Return all supported connector types and their configuration schemas."""
    return ConnectorRegistry.get_all_schemas()

@router.get("")
async def list_connections(
    limit: int = 50, 
    offset: int = 0,
    service: ConnectionService = Depends(get_connection_service)
):
    """List connections with pagination. Default page size: 50."""
    limit = min(limit, 100)
    return await service.list_connections(limit=limit, offset=offset)

@router.get("/{connection_id}")
async def get_connection(
    connection_id: str,
    service: ConnectionService = Depends(get_connection_service)
):
    conn = await service.get_connection(connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    return conn

@router.delete("/{connection_id}")
async def delete_connection(
    connection_id: str,
    service: ConnectionService = Depends(get_connection_service)
):
    await service.delete_connection(connection_id)
    return {"status": "success"}

@router.post("")
async def create_connection(
    config: Dict[str, Any],
    service: ConnectionService = Depends(get_connection_service)
):
    try:
        return await service.create_connection(config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create connection: {str(e)}")

@router.put("/{connection_id}")
async def update_connection(
    connection_id: str,
    config: Dict[str, Any],
    service: ConnectionService = Depends(get_connection_service)
):
    try:
        return await service.update_connection(connection_id, config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update connection: {str(e)}")


@router.post("/test")
async def test_connection(
    config: Dict[str, Any],
    service: ConnectionService = Depends(get_connection_service)
):
    result = await service.test_connection(config)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Connection failed"))
    return result

@router.post("/discover-schema")
async def discover_schema(
    config: Dict[str, Any],
    service: ConnectionService = Depends(get_connection_service)
):
    return await service.get_schema(config)

@router.post("/capabilities")
async def detect_capabilities(
    config: Dict[str, Any],
    service: ConnectionService = Depends(get_connection_service)
):
    return await service.capability_service.detect_capabilities(config)

@router.get("/{connection_id}/performance")
async def get_performance(
    connection_id: str,
    service: ConnectionService = Depends(get_connection_service)
):
    return await service.capability_service.get_capabilities(connection_id)

@router.post("/discover")
async def discover(
    config: Dict[str, Any],
    service: ConnectionService = Depends(get_connection_service)
):
    """Unified discovery endpoint."""
    if config.get("target"):
        return await service.discover_resources(config)
    
    return await service.get_schema(config)

@router.get("/{connection_id}/health")
async def check_connection_health(
    connection_id: str,
    service: ConnectionService = Depends(get_connection_service)
):
    conn_data = await service.get_connection(connection_id)
    if not conn_data:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    conn_data["id"] = connection_id
    return await service.test_connection(conn_data)

@router.post("/preview-data")
async def preview_data(
    config: Dict[str, Any],
    service: ConnectionService = Depends(get_connection_service)
):
    return await service.preview_data(config)
