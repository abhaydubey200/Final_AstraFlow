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
        Scans all 'running' pipeline runs and triggers tasks that are 'ready'.
        A task is 'ready' if all its dependencies are 'completed'.
        """
        async with self.pool.acquire() as conn:
            # 1. Get all active pipeline runs
            active_runs = await conn.fetch(
                "SELECT id, pipeline_id FROM public.pipeline_runs WHERE run_status = 'running'"
            )

            for run in active_runs:
                run_id = run['id']
                pipeline_id = run['pipeline_id']

                # 2. Get all tasks for this pipeline
                tasks = await conn.fetch(
                    "SELECT id, task_name FROM public.pipeline_tasks WHERE pipeline_id = $1",
                    pipeline_id
                )
                
                # 3. Get all dependencies
                deps = await conn.fetch(
                    "SELECT parent_task_id, child_task_id FROM public.pipeline_dependencies WHERE pipeline_id = $1",
                    pipeline_id
                )

                # 4. Get current task run statuses
                task_run_statuses = await conn.fetch(
                    "SELECT task_id, status FROM public.task_runs WHERE pipeline_run_id = $1",
                    run_id
                )
                status_map = {r['task_id']: r['status'] for r in task_run_statuses}

                # 5. Identify ready tasks
                for task in tasks:
                    task_id = task['id']
                    
                    # Already processed, running or queued?
                    if status_map.get(task_id) in ['completed', 'running', 'failed', 'queued']:
                        continue

                    # Check parent dependencies
                    parents = [d['parent_task_id'] for d in deps if d['child_task_id'] == task_id]
                    # Root tasks (no parents) are always ready. 
                    # Others need all parents to be 'completed'.
                    if not parents or all(status_map.get(p_id) == 'completed' for p_id in parents):
                        # Optimization: Check for failed parents to mark as skipped (Future Enhancement)
                        if any(status_map.get(p_id) == 'failed' for p_id in parents):
                             # For now just continue, in real system mark as 'upstream_failed'
                             continue
                             
                        # Task is ready!
                        await self._queue_task(conn, run_id, task_id)
                
                # 6. Check if all tasks are finished to close the run
                if tasks and all(status_map.get(t['id']) == 'completed' for t in tasks):
                    logger.info(f"Pipeline Run {run_id} finished successfully.")
                    
                    # Aggregate rows from staging_files
                    total_rows = await conn.fetchval(
                        "SELECT SUM(row_count) FROM public.staging_files WHERE pipeline_run_id = $1",
                        run_id
                    ) or 0
                    
                    await conn.execute(
                        "UPDATE public.pipeline_runs SET run_status = 'completed', status = 'completed', rows_processed = $1, finished_at = NOW() WHERE id = $2",
                        total_rows, run_id
                    )

    async def _queue_task(self, conn, run_id: str, task_id: str):
        """Insert a record into task_runs to signal workers."""
        logger.info(f"Queuing task {task_id} for run {run_id}")
        await conn.execute(
            """
            INSERT INTO public.task_runs (pipeline_run_id, task_id, status, start_time)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT DO NOTHING
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
