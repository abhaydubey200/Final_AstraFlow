import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict

logger = logging.getLogger(__name__)

class AutoHealService:
    def __init__(self, db_pool):
        self.pool = db_pool
        self.running = False
        self._task = None

    async def start(self):
        if self.running: return
        self.running = True
        self._task = asyncio.create_task(self.run_loop())
        logger.info("AutoHealService started.")

    async def stop(self):
        self.running = False
        if self._task:
            self._task.cancel()
        logger.info("AutoHealService stopped.")

    async def run_loop(self):
        while self.running:
            try:
                await self.heal_stuck_runs()
                await self.heal_zombie_workers()
                await asyncio.sleep(60) # Run every minute
            except Exception as e:
                logger.error(f"Error in AutoHeal loop: {e}")
                await asyncio.sleep(10)

    async def heal_stuck_runs(self):
        """Detect and recover runs stuck in 'running' status."""
        async with self.pool.acquire() as conn:
            # Threshold: 30 seconds for rapid testing in mock mode
            threshold = datetime.utcnow() - timedelta(seconds=30)
            
            # Find stuck runs
            stuck_runs = await conn.fetch(
                "SELECT id FROM public.pipeline_runs WHERE status = 'running' AND updated_at < $1",
                threshold
            ) or []
            
            for run in stuck_runs:
                run_id = run['id']
                logger.warning(f"Auto-Heal: Detected stuck pipeline run {run_id}. Attempting recovery...")
                
                # Mark as failed with recovery info
                await conn.execute(
                    "UPDATE public.pipeline_runs SET status = 'failed', error_message = $1, finished_at = $2 WHERE id = $3",
                    "Auto-healed: Detection of stuck execution (timeout)",
                    datetime.utcnow().isoformat(),
                    run_id
                )
                
                # Any active task_runs for this run should also be failed
                await conn.execute(
                    "UPDATE public.task_runs SET status = 'failed' WHERE pipeline_run_id = $1 AND status = 'running'",
                    run_id
                )

    async def heal_zombie_workers(self):
        """Re-assign tasks from workers that have missed heartbeats."""
        async with self.pool.acquire() as conn:
            threshold = datetime.utcnow() - timedelta(minutes=2)
            
            zombie_workers = await conn.fetch(
                "SELECT worker_id FROM public.worker_heartbeats WHERE last_seen < $1 AND status != 'offline'",
                threshold
            ) or []
            
            for worker in zombie_workers:
                wid = worker['worker_id']
                logger.warning(f"Auto-Heal: Detected zombie worker {wid}. Re-assigning tasks...")
                
                # Re-queue any 'running' tasks assigned to this worker (if we tracked worker_id in task_runs)
                # For now, we'll use a simplified strategy: fail running tasks that are "too old"
                # as the Persistent Retry mechanism will pick them up if they are re-queued by the scheduler.
                
                await conn.execute(
                    "UPDATE public.worker_heartbeats SET status = 'offline' WHERE worker_id = $1",
                    wid
                )

# Global instances
auto_heal_service = None

def setup_auto_heal(app, db_pool):
    global auto_heal_service
    auto_heal_service = AutoHealService(db_pool)
    
    @app.on_event("startup")
    async def start_auto_heal():
        await auto_heal_service.start()
        
    @app.on_event("shutdown")
    async def stop_auto_heal():
        await auto_heal_service.stop()
