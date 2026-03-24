import asyncio
import uuid
import random
import time
from datetime import datetime, timedelta
import asyncpg
from core.base_connector import BaseConnector
from services.scheduler_service import SchedulerService
from services.auto_heal_service import AutoHealService

async def run_stress_test():
    print("🚀 Starting AstraFlow System Stress Test (Stage 7)")
    
    # 1. Setup Mock DB Pool
    # Note: In mock mode, the pool is simulated by mock_db.py
    pool = await asyncpg.create_pool("postgresql://postgres@localhost/astraflow")
    scheduler = SchedulerService(pool)
    auto_heal = AutoHealService(pool)
    
    # 2. Initialize 50 Pipelines
    print(f"--- Initializing 50 Concurrent Pipelines ---")
    pipeline_ids = []
    run_ids = []
    
    async with pool.acquire() as conn:
        print("--- Cleaning Database ---")
        await conn.execute("DELETE FROM public.task_runs")
        await conn.execute("DELETE FROM public.pipeline_runs")
        await conn.execute("DELETE FROM public.staging_files")
        
        for i in range(50):
            p_id = str(uuid.uuid4())
            pipeline_ids.append(p_id)
            
            # Create Pipeline
            await conn.execute(
                "INSERT INTO public.pipelines (id, name, status) VALUES ($1, $2, 'active')",
                p_id, f"Stress_Pipeline_{i}"
            )
            
            # Create Tasks (Extract -> Load)
            t1_id = str(uuid.uuid4())
            t2_id = str(uuid.uuid4())
            await conn.execute(
                "INSERT INTO public.pipeline_tasks (id, pipeline_id, task_name, task_type) VALUES ($1, $2, 'Extract', 'source')",
                t1_id, p_id
            )
            await conn.execute(
                "INSERT INTO public.pipeline_tasks (id, pipeline_id, task_name, task_type) VALUES ($1, $2, 'Load', 'destination')",
                t2_id, p_id
            )
            
            # Dependencies
            await conn.execute(
                "INSERT INTO public.pipeline_dependencies (pipeline_id, parent_task_id, child_task_id) VALUES ($1, $2, $3)",
                p_id, t1_id, t2_id
            )
            
            # Start Run
            r_id = str(uuid.uuid4())
            run_ids.append(r_id)
            await conn.execute(
                "INSERT INTO public.pipeline_runs (id, pipeline_id, run_status, status, started_at) VALUES ($1, $2, 'running', 'running', $3)",
                r_id, p_id, datetime.now()
            )

    print(f"✅ 50 Pipelines initialized and 'running'.")

    # 3. Start Orchestration Services
    orchestrator_task = asyncio.create_task(scheduler.run_loop())
    auto_heal_task = asyncio.create_task(auto_heal.run_loop())
    
    print("--- Orchestration Services Started ---")

    # 4. Simulate Worker Activity & Failures
    # We will simulate workers picking up tasks and some failing.
    async def simulate_worker_nodes():
        total_worked = 0
        while total_worked < 100: # 50 pipelines * 2 tasks
            async with pool.acquire() as conn:
                queued_tasks = await conn.fetch(
                    "SELECT id, pipeline_run_id, task_id FROM public.task_runs WHERE status = 'queued' LIMIT 10"
                )
                
                for task in queued_tasks:
                    # Pick up task
                    worker_id = f"worker_{random.randint(1, 10)}"
                    await conn.execute(
                        "UPDATE public.task_runs SET status = 'running', worker_id = $1, updated_at = NOW() WHERE id = $2",
                        worker_id, task['id']
                    )
                    
                    # 20% failure probability
                    if random.random() < 0.2:
                        print(f"⚠️ Worker {worker_id} crashed while processing {task['task_id']}")
                        # Don't update status, leave it 'running' to trigger Auto-Heal
                        continue
                    
                    # Process and Complete
                    await asyncio.sleep(0.1) # Simulate work
                    await conn.execute(
                        "INSERT INTO public.staging_files (pipeline_run_id, task_id, row_count) VALUES ($1, $2, $3)",
                        task['pipeline_run_id'], task['task_id'], random.randint(100, 1000)
                    )
                    await conn.execute(
                        "UPDATE public.task_runs SET status = 'completed', updated_at = NOW() WHERE id = $1",
                        task['id']
                    )
                    total_worked += 1
            await asyncio.sleep(0.5)

    worker_sim = asyncio.create_task(simulate_worker_nodes())

    # 5. Monitor Progress
    start_time = time.time()
    timeout = 60 # 1 minute stress test
    
    while time.time() - start_time < timeout:
        async with pool.acquire() as conn:
            counts = await conn.fetchrow("""
                SELECT 
                    COUNT(*) FILTER (WHERE run_status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE run_status = 'running') as running
                FROM public.pipeline_runs
            """)
            print(f"📊 Progress: {counts['completed']} Completed, {counts['running']} Running...")
            
            if counts['running'] == 0:
                print("🎉 All pipelines finished successfully!")
                break
                
        await asyncio.sleep(2)

    # 6. Cleanup
    orchestrator_task.cancel()
    auto_heal_task.cancel()
    worker_sim.cancel()
    print("--- Stress Test Finished ---")

if __name__ == "__main__":
    asyncio.run(run_stress_test())
