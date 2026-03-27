import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
from core.supabase_client import supabase, supabase_logger
from core.decorators import safe_execute

logger = logging.getLogger(__name__)

class AutoHealService:
    def __init__(self, db_pool: Any = None):
        self.supabase = supabase
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

    @safe_execute()
    async def heal_stuck_runs(self):
        """Detect and recover runs stuck in 'running' status using SDK."""
        # Threshold: 1 hour for production safety (relaxed for manual testing if needed)
        threshold = (datetime.utcnow() - timedelta(hours=1)).isoformat()
        
        # Find stuck runs
        res = self.supabase.table("pipeline_runs").select("id").eq("status", "running").lt("created_at", threshold).execute()
        stuck_runs = res.data or []
        
        for run in stuck_runs:
            run_id = run['id']
            logger.warning(f"Auto-Heal: Detected stuck pipeline run {run_id}. Attempting recovery...")
            
            # Mark as failed
            self.supabase.table("pipeline_runs").update({
                "status": "failed",
                "error_message": "Auto-healed: Detection of stuck execution (timeout)",
                "finished_at": "now()"
            }).eq("id", run_id).execute()
            
            # Fail active task_runs
            self.supabase.table("task_runs").update({"status": "failed"}).eq("pipeline_run_id", run_id).eq("status", "running").execute()

    @safe_execute()
    async def heal_zombie_workers(self):
        """Re-assign tasks from workers that have missed heartbeats using SDK."""
        threshold = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
        
        res = self.supabase.table("worker_heartbeats").select("worker_id").lt("last_seen", threshold).neq("status", "offline").execute()
        zombie_workers = res.data or []
        
        for worker in zombie_workers:
            wid = worker['worker_id']
            logger.warning(f"Auto-Heal: Detected zombie worker {wid}. Marking offline...")
            
            self.supabase.table("worker_heartbeats").update({"status": "offline"}).eq("worker_id", wid).execute()

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
