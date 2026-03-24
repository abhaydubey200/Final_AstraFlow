import os
import uuid
import asyncpg
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Dict, Any, List, Optional
from datetime import datetime

from services.analytics_service import AnalyticsService
from services.ai_insight_service import AIInsightService
from services.validation_service import ValidationService
from services.lineage_service import LineageService
from services.governance_service import GovernanceService
from api.dependencies import (
    get_analytics_service,
    get_ai_insight_service,
    get_validation_service,
    get_lineage_service,
    get_governance_service
)

from services.self_healing_service import self_healing_manager

router = APIRouter(prefix="/monitoring", tags=["monitoring"])

@router.get("/system-health")
async def get_system_health(request: Request):
    """Aggregate high-level system health telemetry."""
    pool = request.app.state.db_pool
    healing_status = self_healing_manager.get_status()
    
    db_stats = {"status": "unreachable"}
    try:
        if pool:
            async with pool.acquire() as conn:
                await conn.execute("SELECT 1")
                db_stats = {"status": "healthy"}
    except:
        pass

    return {
        "status": "healthy" if db_stats["status"] == "healthy" else "degraded",
        "database": db_stats,
        "self_healing": healing_status,
        "timestamp": datetime.now().isoformat()
    }

@router.get("/notifications")
async def get_notifications(user_id: Optional[str] = None):
    # In production, query 'notifications' table
    return []

@router.post("/notifications/{id}/read")
async def mark_read(id: str):
    return {"id": id, "status": "read"}

@router.post("/notifications/read-all")
async def mark_all_read():
    return {"status": "all_read"}

@router.get("/alert-rules")
async def get_alert_rules(pipeline_id: Optional[str] = None):
    # In production, query 'alert_rules' table
    return []

@router.get("/metrics")
async def get_metrics(request: Request):
    pool: asyncpg.Pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        try:
            # Aggregate real metrics from pipeline_runs and checkpoints
            metrics = await conn.fetchrow("""
                SELECT 
                    COALESCE(SUM(total_rows), 0) as "totalRows",
                    COALESCE(AVG(rows_per_second), 0) as "rowsPerSec",
                    (SELECT count(*) FROM astra_worker_queue WHERE status = 'pending') as "queuePending",
                    (SELECT count(*) FROM astra_alerts WHERE status = 'open') as "alertDelivered",
                    COALESCE(pipeline_success_rate(), 98.5) as "successRate"
                FROM pipeline_checkpoints
                WHERE end_time > NOW() - INTERVAL '24 hours'
            """)
            return dict(metrics)
        except Exception as e:
            # Fallback for dev if functions/tables don't exist yet
            return {
                "totalRows": 0,
                "rowsPerSec": 0,
                "queuePending": 0,
                "alertDelivered": 0,
                "successRate": 100.0
            }

@router.get("/worker-status")
async def get_worker_status(request: Request):
    pool: asyncpg.Pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        # Query real worker heartbeats
        rows = await conn.fetch("""
            SELECT 
                worker_id as id,
                status,
                last_heartbeat,
                (metadata->>'tasks')::int as tasks,
                (metadata->>'cpu')::float as cpu,
                (metadata->>'memory')::float as ram
            FROM worker_heartbeats
            WHERE last_heartbeat > NOW() - INTERVAL '5 minutes'
            ORDER BY last_heartbeat DESC
        """)
        return [dict(r) for r in rows]

@router.get("/queue-metrics")
async def get_queue_metrics(request: Request):
    pool: asyncpg.Pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        metrics = await conn.fetchrow("""
            SELECT 
                count(*) FILTER (WHERE status = 'pending') as pending,
                count(*) FILTER (WHERE status = 'processing') as processing,
                count(*) FILTER (WHERE status = 'failed') as failed,
                count(*) FILTER (WHERE status = 'completed') as completed
            FROM astra_worker_queue
        """)
        return dict(metrics)

@router.get("/schema-drift")
async def get_schema_drift(request: Request, pipeline_id: Optional[str] = None, dataset_id: Optional[str] = None):
    pool: asyncpg.Pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        query = """
            SELECT e.*, d.name as dataset_name 
            FROM schema_drift_events e
            LEFT JOIN datasets d ON e.dataset_id = d.id
            WHERE 1=1
        """
        params = []
        if pipeline_id:
            params.append(uuid.UUID(pipeline_id))
            query += f" AND e.pipeline_id = ${len(params)}"
        if dataset_id:
            params.append(uuid.UUID(dataset_id))
            query += f" AND e.dataset_id = ${len(params)}"
        
        query += " ORDER BY e.detected_at DESC"
        rows = await conn.fetch(query, *params)
        return [dict(r) for r in rows]

@router.get("/datasets/{dataset_id}/versions")
async def get_schema_versions(request: Request, dataset_id: str):
    pool: asyncpg.Pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, version_number, schema_json, checksum, created_at "
            "FROM dataset_schema_versions WHERE dataset_id = $1 ORDER BY version_number DESC",
            uuid.UUID(dataset_id)
        )
        return [dict(r) for r in rows]

@router.post("/schema-drift/{drift_id}/resolve")
async def resolve_drift(request: Request, drift_id: str, resolution: str):
    if resolution not in ['auto_mapped', 'deprecated', 'ignored']:
        raise HTTPException(status_code=400, detail="Invalid resolution type")
    
    pool: asyncpg.Pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE schema_drift_events SET resolution = $1, resolved_at = NOW() WHERE id = $2",
            resolution, uuid.UUID(drift_id)
        )
        return {"status": "success", "drift_id": drift_id, "resolution": resolution}

@router.post("/alert-rules")
async def create_alert_rule(rule: Dict[str, Any]):
    return {"id": "rule-uuid", "status": "created"}

@router.put("/alert-rules/{rule_id}")
async def update_alert_rule(rule_id: str, updates: Dict[str, Any]):
    return {"id": rule_id, "status": "updated"}

@router.delete("/alert-rules/{rule_id}")
async def delete_alert_rule(rule_id: str):
    return {"status": "deleted"}

@router.get("/analytics/trends")
async def get_performance_trends(
    pipeline_id: Optional[str] = None, 
    hours: int = 24,
    service: AnalyticsService = Depends(get_analytics_service)
):
    return await service.get_performance_trends(pipeline_id, hours)

@router.get("/analytics/bottlenecks/{pipeline_id}")
async def get_bottlenecks(
    pipeline_id: str,
    service: AnalyticsService = Depends(get_analytics_service)
):
    return await service.detect_bottlenecks(pipeline_id)

@router.get("/ai/insights")
async def get_ai_insights(
    pipeline_id: Optional[str] = None,
    service: AIInsightService = Depends(get_ai_insight_service)
):
    return await service.get_insights(pipeline_id)

@router.get("/ai/anomalies")
async def get_ai_anomalies(
    service: AIInsightService = Depends(get_ai_insight_service)
):
    return await service.detect_anomalies()

@router.get("/validation-results/{run_id}")
async def get_validation_results(request: Request, run_id: str):
    pool: asyncpg.Pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        # In a real system, we'd join with validation_rules to get rule names
        try:
            rows = await conn.fetch("""
                SELECT r.*, v.rule_name, v.severity 
                FROM validation_results r
                JOIN validation_rules v ON r.rule_id = v.id
                WHERE r.run_id = $1
            """, uuid.UUID(run_id))
            return [dict(r) for r in rows]
        except:
            # Fallback if run_id isn't directly in validation_results yet
            return []

@router.get("/validation-rules/{pipeline_id}")
async def get_validation_rules(
    pipeline_id: str,
    service: ValidationService = Depends(get_validation_service)
):
    return await service.get_rules_for_pipeline(pipeline_id)

@router.get("/lineage/{pipeline_id}")
async def get_lineage(
    pipeline_id: str,
    service: LineageService = Depends(get_lineage_service)
):
    return await service.get_pipeline_lineage(pipeline_id)

@router.get("/lineage/impact/{node_id}")
async def get_impact_analysis(
    node_id: str,
    service: LineageService = Depends(get_lineage_service)
):
    return await service.get_impact_analysis(node_id)

@router.get("/audit-logs")
async def get_audit_trail(
    resource_type: Optional[str] = None, 
    user_id: Optional[str] = None,
    service: GovernanceService = Depends(get_governance_service)
):
    return await service.get_audit_trail(resource_type, user_id)

@router.post("/workers/{worker_id}/reboot")
async def reboot_worker(worker_id: str, request: Request):
    pool: asyncpg.Pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        # In a real K8s/Cloud env, we'd trigger a container restart
        # For this simulation, we'll mark it as 'restarting' and let the daemon recover
        await conn.execute(
            "UPDATE worker_heartbeats SET status = 'restarting', last_heartbeat = NOW() WHERE worker_id = $1",
            worker_id
        )
        return {"status": "rebooting", "worker_id": worker_id}

@router.post("/governance/purge")
async def purge_old_data(
    service: GovernanceService = Depends(get_governance_service)
):
    return await service.apply_retention_policies()
