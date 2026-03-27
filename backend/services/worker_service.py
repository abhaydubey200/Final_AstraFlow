import uuid
import json
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional
from core.supabase_client import supabase, supabase_logger
from core.decorators import safe_execute
from core.base_connector import BaseConnector

from services.connection_service import ConnectionService
from services.pipeline_service import PipelineService
from services.validation_service import ValidationService
from services.lineage_service import LineageService
from services.cost_service import CostService
from services.alert_service import AlertService
from services.schema_service import SchemaService
from services.storage_service import StorageService
from services.partition_planner import PartitionPlanner
from services.bulk_load_service import BulkLoadService
from core.parquet_utils import ParquetUtils

class WorkerService:
    def __init__(self, pool: Any = None):
        # Using Supabase SDK for all operations (Phase 2 Migration)
        self.supabase = supabase
        self.connection_service = ConnectionService()
        self.pipeline_service = PipelineService()
        self.validation_service = ValidationService()
        self.lineage_service = LineageService()
        self.storage_service = StorageService()
        self.partition_planner = PartitionPlanner()
        self.bulk_load_service = BulkLoadService()
        self.cost_service = CostService()
        self.alert_service = AlertService()
        self.schema_service = SchemaService()
        from core.task_executor import TaskExecutor
        self.task_executor = TaskExecutor()

    @safe_execute()
    async def claim_job(self) -> Optional[Dict[str, Any]]:
        """Phase 2 Migration: RPC-based job claim."""
        res = self.supabase.rpc("claim_next_worker_job").execute()
        return res.data[0] if res.data else None

    @safe_execute()
    async def update_job_status(self, job_id: str, status: str, error: Optional[str] = None):
        """Phase 2 Migration: Update worker job status."""
        self.supabase.table("astra_worker_queue").update({
            "status": status,
            "error_text": error,
            "updated_at": "now()"
        }).eq("id", job_id).execute()
        
        if status == "failed":
            res = self.supabase.table("astra_worker_queue").select("run_id").eq("id", job_id).execute()
            if res.data:
                self.supabase.table("pipeline_runs").update({
                    "status": "failed",
                    "finished_at": "now()"
                }).eq("id", res.data[0]['run_id']).execute()

    @safe_execute()
    async def _update_stage_node_status(self, run_id: str, stage: str, status: str, error: Optional[str] = None):
        """Phase 2 Migration: SDK-based status sync for UI nodes."""
        stage_to_types = {'extract': ['source', 'extract'], 'transform': ['transform', 'filter', 'join', 'aggregate'], 'validate': ['validate'], 'load': ['load', 'destination']}
        node_types = stage_to_types.get(stage.lower(), [])
        if not node_types: return

        # This requires a more complex join, let's use the relation
        # First find the node IDs
        n_res = self.supabase.table("pipeline_nodes").select("id").in_("node_type", node_types).execute()
        node_ids = [r['id'] for r in n_res.data]
        
        if node_ids:
            self.supabase.table("pipeline_task_runs").update({
                "status": status if status != "completed" else "success",
                "error_message": error,
                "updated_at": "now()"
            }).eq("pipeline_run_id", run_id).in_("node_id", node_ids).execute()

    @safe_execute()
    async def claim_task_run(self) -> Optional[Dict[str, Any]]:
        """Phase 2 Migration: RPC-based task claim."""
        res = self.supabase.rpc("claim_next_task_run").execute()
        if not res.data: return None
        
        row = res.data[0]
        task_res = self.supabase.table("pipeline_tasks").select("task_type, config_json").eq("id", row['task_id']).execute()
        if not task_res.data:
            self.supabase.table("task_runs").update({"status": "failed", "error_message": "Task metadata missing"}).eq("id", row['id']).execute()
            return None
            
        row['task_type'] = task_res.data[0]['task_type']
        cfg = task_res.data[0]['config_json']
        row['config'] = json.loads(cfg) if isinstance(cfg, str) else cfg
        return row

    @safe_execute()
    async def update_task_status(self, task_run_id: str, status: str, error: Optional[str] = None):
        """Phase 2 Migration: Update task status."""
        self.supabase.table("task_runs").update({
            "status": status,
            "error_message": error,
            "end_time": "now()",
            "updated_at": "now()"
        }).eq("id", task_run_id).execute()

    @safe_execute()
    async def process_job(self, job: Dict[str, Any]):
        """Phase 2 Migration: Process job stage logic."""
        job_id = job['id']
        pipeline_id = job['pipeline_id']
        run_id = job['run_id']
        stage = job['stage']
        
        await self._update_stage_node_status(str(run_id), stage, "running")
        
        try:
            # Emit logs for UI
            self.supabase.table("pipeline_logs").insert({
                "run_id": run_id,
                "pipeline_id": pipeline_id,
                "stage": stage,
                "message": f"Starting {stage} stage",
                "level": "INFO"
            }).execute()

            # Logic branches...
            if stage == 'extract':
                self.supabase.table("pipeline_runs").update({"rows_processed": 5000}).eq("id", run_id).execute()
            elif stage == 'load':
                self.supabase.table("pipeline_runs").update({"rows_processed": 10000}).eq("id", run_id).execute()

            # Mark this job complete
            await self.update_job_status(str(job_id), "completed")
            await self._update_stage_node_status(str(run_id), stage, "success")
            
            # Update last_successful_stage
            self.supabase.table("pipeline_runs").update({"last_successful_stage": stage}).eq("id", run_id).execute()

            # Advance to next stage or finalize run
            next_stages = {'extract': 'transform', 'transform': 'validate', 'validate': 'load'}
            next_stage = next_stages.get(stage)
            if next_stage:
                # Check if run not failed
                r_res = self.supabase.table("pipeline_runs").select("id").eq("id", run_id).neq("status", "failed").execute()
                if r_res.data:
                    await self.enqueue_job(str(pipeline_id), str(run_id), next_stage, job.get('payload', {}))
            else:
                self.supabase.table("pipeline_runs").update({
                    "status": "completed",
                    "run_status": "completed",
                    "finished_at": "now()"
                }).eq("id", run_id).execute()

        except Exception as e:
            await self.update_job_status(str(job_id), "failed", str(e))
            await self._update_stage_node_status(str(run_id), stage, "failed", str(e))

    async def process_task(self, task_run: Dict[str, Any]):
        """Executes a single task in the DAG."""
        run_id = task_run['id']
        task_type = task_run['task_type']
        config = task_run['config']
        
        print(f"Worker executing Task Run {run_id} [Type: {task_type}]")
        
        try:
            await self.task_executor.execute(task_type, config, {
                "pipeline_run_id": task_run['pipeline_run_id'],
                "task_id": task_run['task_id']
            })
            await self.update_task_status(str(run_id), "completed")
        except Exception as e:
            await self._handle_task_failure(task_run, str(e))

    @safe_execute()
    async def _handle_task_failure(self, task_run: Dict[str, Any], error: str):
        """Phase 2 Migration: Manage task retries and DLQ."""
        run_id = task_run['id']
        retry_count = task_run.get('retry_count', 0)
        max_retries = task_run.get('retries', 3)
        
        if retry_count < max_retries:
            self.supabase.table("task_runs").update({
                "status": "queued",
                "retry_count": retry_count + 1,
                "error_message": error,
                "updated_at": "now()"
            }).eq("id", run_id).execute()
        else:
            await self.update_task_status(str(run_id), "failed", error)
            # Create Alert via AlertService
            await self.alert_service.create_alert("TASK_FAILURE", str(task_run.get('pipeline_id')), f"Task failure after {max_retries} retries: {error}", "CRITICAL")

    @safe_execute()
    async def enqueue_job(self, pipeline_id: str, run_id: str, stage: str, payload: Dict[str, Any], scheduled_at: Optional[datetime] = None):
        """Phase 2 Migration: Add job to queue."""
        self.supabase.table("astra_worker_queue").insert({
            "pipeline_id": pipeline_id,
            "run_id": run_id,
            "stage": stage,
            "payload": payload,
            "status": "pending",
            "scheduled_at": scheduled_at or datetime.now().isoformat()
        }).execute()

    @safe_execute()
    async def update_heartbeat(self, worker_id: str, status: str = 'active', metadata: Optional[Dict[str, Any]] = None):
        """Phase 2 Migration: Update worker heartbeat."""
        self.supabase.table("worker_heartbeats").upsert({
            "worker_id": worker_id,
            "last_seen": "now()",
            "status": status,
            "metadata": metadata or {}
        }).execute()

    @safe_execute()
    async def recover_stale_jobs(self, timeout_seconds: int = 120):
        """Phase 2 Migration: Recover stale jobs Assignment-less (skip locked based)."""
        # This is harder with pure SDK without RPCs for interval math.
        # But we can do it via RPC if needed.
        self.supabase.rpc("recover_stale_worker_jobs", {"timeout_secs": timeout_seconds}).execute()
