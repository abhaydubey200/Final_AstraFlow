import asyncio
import httpx
import uuid
import time
import random
import statistics
from datetime import datetime

import sys

# Ensure UTF-8 output even on Windows redirection
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8081"
NUM_USERS = 20
PIPELINES_PER_USER = 3 # Total ~60 pipelines
TIMEOUT = 120 # 2 minutes max for the whole test

async def simulate_user(user_id: int):
    results = []
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        for i in range(PIPELINES_PER_USER):
            p_name = f"LoadTest_User{user_id}_Pipe{i}_{str(uuid.uuid4())[:4]}"
            
            # 1. Create Pipeline
            nodes = [
                {
                    "id": str(uuid.uuid4()),
                    "node_type": "extract",
                    "label": "Extract",
                    "config_json": {"table_name": "source_data", "connection_id": str(uuid.uuid4())}
                },
                {
                    "id": str(uuid.uuid4()),
                    "node_type": "load",
                    "label": "Load",
                    "config_json": {"table_name": "target_data", "target_connection_id": str(uuid.uuid4())}
                }
            ]
            edges = [{"source_node_id": nodes[0]["id"], "target_node_id": nodes[1]["id"]}]
            
            payload = {
                "pipeline": {"name": p_name, "environment": "dev", "execution_mode": "linear"},
                "nodes": nodes,
                "edges": edges
            }
            
            start_create = time.time()
            try:
                resp = await client.post("/pipelines", json=payload)
                resp.raise_for_status()
                pipeline_id = resp.json()["id"]
                results.append({"action": "create", "latency": time.time() - start_create, "success": True})
            except Exception as e:
                print(f"User {user_id} failed to create pipeline: {e}")
                results.append({"action": "create", "success": False, "error": str(e)})
                continue

            # 2. Trigger Run
            start_run = time.time()
            try:
                resp = await client.post(f"/pipelines/{pipeline_id}/run", json={"source": {}, "destination": {}})
                resp.raise_for_status()
                run_id = resp.json()["run_id"]
                results.append({"action": "run", "latency": time.time() - start_run, "success": True})
            except Exception as e:
                print(f"User {user_id} failed to trigger run for {pipeline_id}: {e}")
                results.append({"action": "run", "success": False, "error": str(e)})
                continue

            # 3. Poll for completion (with some randomness to jitter requests)
            await asyncio.sleep(random.uniform(1, 3))
            completed = False
            for _ in range(20): # Poll up to 20 times (every 2-5s)
                try:
                    resp = await client.get(f"/pipelines/runs/{run_id}")
                    if resp.status_code == 404:
                        print(f"Polling error for run {run_id}: 404 Not Found. Body: {resp.text}")
                        # The original code would continue polling or break if an error occurred.
                        # To maintain the original flow, we'll treat 404 as a failure for this poll attempt
                        # but not necessarily terminate the entire user simulation or the polling loop immediately.
                        # However, the instruction's snippet implies a more immediate handling.
                        # Given the context, it's best to let the outer exception handler catch it
                        # if raise_for_status is called, or handle it here and break.
                        # The instruction's `return` is problematic, so we'll adapt.
                        break # Break from polling loop if 404, as it's unlikely to recover
                    resp.raise_for_status()
                    data = resp.json()
                    if data["status"] == "completed":
                        completed = True
                        break
                    elif data["status"] == "failed":
                        print(f"Run {run_id} failed: {data.get('error_message')}")
                        break
                except Exception as e:
                    print(f"Polling error for run {run_id}: {e}")
                
                await asyncio.sleep(random.uniform(2, 5))
            
            results.append({"action": "completion", "success": completed, "run_id": run_id})

    return results

async def run_simulation():
    print(f"Starting Full System Load Simulation: {NUM_USERS} users, ~{NUM_USERS*PIPELINES_PER_USER} pipelines")
    start_time = time.time()
    
    user_tasks = [simulate_user(i) for i in range(NUM_USERS)]
    all_results = await asyncio.gather(*user_tasks)
    
    duration = time.time() - start_time
    print(f"\n--- Simulation Finished in {duration:.2f}s ---")
    
    flat_results = [item for sublist in all_results for item in sublist]
    
    creates = [r for r in flat_results if r["action"] == "create"]
    runs = [r for r in flat_results if r["action"] == "run"]
    completions = [r for r in flat_results if r["action"] == "completion"]
    
    create_latencies = [r["latency"] for r in creates if r["success"]]
    run_latencies = [r["latency"] for r in runs if r["success"]]
    
    print("\nStatistics:")
    print(f"Total Pipelines Created: {len([r for r in creates if r['success']])} / {len(creates)}")
    print(f"Total Runs Triggered:    {len([r for r in runs if r['success']])} / {len(runs)}")
    print(f"Total Runs Completed:    {len([r for r in completions if r['success']])} / {len(completions)}")
    
    if create_latencies:
        print(f"Create Latency (Avg):    {statistics.mean(create_latencies):.3f}s")
        print(f"Create Latency (P95):    {sorted(create_latencies)[int(len(create_latencies)*0.95)]:.3f}s")
    
    if run_latencies:
        print(f"Run Trigger Latency (Avg): {statistics.mean(run_latencies):.3f}s")
        print(f"Run Trigger Latency (P95): {sorted(run_latencies)[int(len(run_latencies)*0.95)]:.3f}s")

    success_rate = (len([r for r in completions if r['success']]) / len(completions)) * 100 if completions else 0
    print("\nOverall Success Rate:")
    
    if success_rate < 90:
        print("❌ LOAD TEST FAILED: Success rate below 90%")
        exit(1)
    else:
        print("LOAD TEST PASSED!")

if __name__ == "__main__":
    try:
        asyncio.run(run_simulation())
    except Exception:
        import traceback
        traceback.print_exc()
