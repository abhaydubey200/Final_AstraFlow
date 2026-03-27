import asyncio
import logging
from datetime import datetime
from typing import List, Dict, Any
from core.supabase_client import supabase, supabase_logger
from core.decorators import safe_execute

logger = logging.getLogger(__name__)

class SchedulerService:
    def __init__(self, pool: Any = None):
        # Using Supabase SDK for all operations (Phase 2 Migration)
        self.supabase = supabase

    @safe_execute()
    async def schedule_ready_tasks(self):
        """Phase 2 Migration: Scan and trigger ready tasks via SDK."""
        active_res = self.supabase.table("pipeline_runs").select("id, pipeline_id").eq("run_status", "running").execute()
        if not active_res.data: return

        for run in active_res.data:
            run_id, pipeline_id = run['id'], run['pipeline_id']
            
            # 2. Fetch tasks, dependencies, and task_runs
            tasks = self.supabase.table("pipeline_tasks").select("id, task_name").eq("pipeline_id", pipeline_id).execute().data
            deps = self.supabase.table("pipeline_dependencies").select("parent_task_id, child_task_id").eq("pipeline_id", pipeline_id).execute().data
            runs = self.supabase.table("task_runs").select("task_id, status, next_retry_at").eq("pipeline_run_id", run_id).execute().data
            
            status_map = {r['task_id']: r['status'] for r in runs}
            
            ready_tasks = []
            for task in tasks:
                tid = task['id']
                status = status_map.get(tid)
                
                if status in ['completed', 'running', 'failed', 'queued']: continue
                
                parents = [d['parent_task_id'] for d in deps if d['child_task_id'] == tid]
                if not parents or all(status_map.get(pid) == 'completed' for pid in parents):
                    if not any(status_map.get(pid) == 'failed' for pid in parents):
                        ready_tasks.append(tid)

            if ready_tasks:
                await self._batch_queue_tasks(run_id, ready_tasks)

            # Finalize run if all tasks complete
            if tasks and all(status_map.get(t['id']) == 'completed' for t in tasks):
                # Calculate total rows via staging_files
                sf_res = self.supabase.table("staging_files").select("row_count").eq("pipeline_run_id", run_id).execute()
                total_rows = sum(r['row_count'] for r in sf_res.data) if sf_res.data else 0
                self.supabase.table("pipeline_runs").update({
                    "run_status": "completed",
                    "status": "completed",
                    "rows_processed": total_rows,
                    "finished_at": "now()"
                }).eq("id", run_id).execute()

                # Finalize run if all tasks complete
                if tasks and all(status_map.get(t['id']) == 'completed' for t in tasks):
                    total_rows = await conn.fetchval("SELECT SUM(row_count) FROM public.staging_files WHERE pipeline_run_id = $1", run_id) or 0
                    await conn.execute("UPDATE public.pipeline_runs SET run_status = 'completed', status = 'completed', rows_processed = $1, finished_at = NOW() WHERE id = $2", total_rows, run_id)

    @safe_execute()
    async def _batch_queue_tasks(self, run_id: str, task_ids: List[str]):
        """Phase 2 Migration: Upsert task runs to signal workers."""
        payload = []
        for tid in task_ids:
            payload.append({
                "pipeline_run_id": run_id,
                "task_id": tid,
                "status": "queued",
                "start_time": "now()"
            })
        if payload:
            self.supabase.table("task_runs").upsert(payload, on_conflict="pipeline_run_id, task_id").execute()

    async def _queue_task(self, conn, run_id: str, task_id: str):
        """Insert a record into task_runs to signal workers."""
        logger.info(f"Queuing task {task_id} for run {run_id}")
        await conn.execute(
            """
            INSERT INTO public.task_runs (pipeline_run_id, task_id, status, start_time)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (pipeline_run_id, task_id) 
            DO UPDATE SET status = 'queued', updated_at = NOW() 
            WHERE public.task_runs.status = 'retrying'
            """,
            run_id, task_id, 'queued', datetime.now()
        )
        # In a real system, we would also push to Redis/Celery here.
        # For AstraFlow, worker_service will poll for 'queued' task_runs.

    async def run_loop(self):
        """Main scheduler loop."""
        while True:
            try:
                await self.schedule_ready_tasks()
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
            await asyncio.sleep(5) # Poll every 5 seconds
