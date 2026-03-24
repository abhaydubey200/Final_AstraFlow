import asyncio
import logging
from datetime import datetime
from typing import List, Dict, Any
import asyncpg
from core.dag_validator import DAGValidator

logger = logging.getLogger(__name__)

class SchedulerService:
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool

    async def schedule_ready_tasks(self):
        """
        Optimized scheduler: Scans all 'running' pipeline runs and triggers ready tasks in batches.
        """
        async with self.pool.acquire() as conn:
            # 1. Fetch all relevant data in a single batch where possible
            active_runs = await conn.fetch("SELECT id, pipeline_id FROM public.pipeline_runs WHERE run_status = 'running'")
            if not active_runs: return

            for run in active_runs:
                run_id, pipeline_id = run['id'], run['pipeline_id']
                
                # Batch fetch tasks, dependencies and existing statuses
                tasks = await conn.fetch("SELECT id, task_name FROM public.pipeline_tasks WHERE pipeline_id = $1", pipeline_id)
                deps = await conn.fetch("SELECT parent_task_id, child_task_id FROM public.pipeline_dependencies WHERE pipeline_id = $1", pipeline_id)
                task_runs = await conn.fetch("SELECT task_id, status, next_retry_at FROM public.task_runs WHERE pipeline_run_id = $1", run_id)
                
                status_map = {r['task_id']: r['status'] for r in task_runs}
                retry_map = {r['task_id']: r['next_retry_at'] for r in task_runs}

                ready_tasks = []
                for task in tasks:
                    tid = task['id']
                    status = status_map.get(tid)
                    
                    if status in ['completed', 'running', 'failed', 'queued']: continue
                    
                    if status == 'retrying':
                        if not retry_map.get(tid) or retry_map.get(tid) > datetime.now(): continue
                    
                    parents = [d['parent_task_id'] for d in deps if d['child_task_id'] == tid]
                    if not parents or all(status_map.get(pid) == 'completed' for pid in parents):
                        if not any(status_map.get(pid) == 'failed' for pid in parents):
                            ready_tasks.append(tid)

                if ready_tasks:
                    await self._batch_queue_tasks(conn, run_id, ready_tasks)

                # Finalize run if all tasks complete
                if tasks and all(status_map.get(t['id']) == 'completed' for t in tasks):
                    total_rows = await conn.fetchval("SELECT SUM(row_count) FROM public.staging_files WHERE pipeline_run_id = $1", run_id) or 0
                    await conn.execute("UPDATE public.pipeline_runs SET run_status = 'completed', status = 'completed', rows_processed = $1, finished_at = NOW() WHERE id = $2", total_rows, run_id)

    async def _batch_queue_tasks(self, conn, run_id: str, task_ids: List[str]):
        """Efficiently queue multiple tasks using a single batch operation."""
        logger.info(f"Batch queuing {len(task_ids)} tasks for run {run_id}")
        
        # Prepare data for executemany
        data = [(run_id, tid) for tid in task_ids]
        
        await conn.executemany("""
            INSERT INTO public.task_runs (pipeline_run_id, task_id, status, start_time)
            VALUES ($1, $2, 'queued', NOW())
            ON CONFLICT (pipeline_run_id, task_id) 
            DO UPDATE SET status = 'queued', updated_at = NOW() 
            WHERE public.task_runs.status = 'retrying'
        """, data)

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
