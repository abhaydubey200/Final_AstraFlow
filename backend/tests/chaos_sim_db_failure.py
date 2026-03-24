
import asyncio
import httpx
import time
import os
import shutil
import uuid

BASE_URL = "http://localhost:8081"
MOCK_FILE = r"backend/mock_store.json"
BACKUP_FILE = r"backend/mock_store.json.bak"

async def run_chaos_db_test():
    print("Starting Chaos Test: Database Failure Simulation")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Create a pipeline
        print("Creating pipeline...")
        resp = await client.post(f"{BASE_URL}/pipelines", json={
            "pipeline": {
                "name": f"Chaos DB Pipeline",
                "description": "Simulation for Stage 8 Chaos Testing"
            },
            "nodes": [
                {
                    "id": "node1", 
                    "node_type": "source", 
                    "label": "Demo Source",
                    "config_json": {}
                }
            ],
            "edges": []
        })
        resp.raise_for_status()
        pipeline_id = resp.json()["id"]
        print(f"Pipeline created with ID: {pipeline_id}")
        
        # 2. Trigger Run
        print("Triggering run...")
        resp = await client.post(f"{BASE_URL}/pipelines/{pipeline_id}/run", json={"source": {}, "destination": {}})
        resp.raise_for_status()
        run_id = resp.json()["run_id"]
        
        # 3. Simulate DB Outage (Move the file)
        abs_mock = os.path.abspath(MOCK_FILE)
        print(f"!!! SIMULATING DB OUTAGE (moving {abs_mock}) !!!")
        if os.path.exists(MOCK_FILE):
            try:
                shutil.move(MOCK_FILE, BACKUP_FILE)
                print("DEBUG_SIM: Move SUCCEEDED.")
            except Exception as e:
                print(f"DEBUG_SIM: Move FAILED: {e}")
        else:
            print("DEBUG_SIM: MOCK_FILE did not exist to move!")
        
        print(f"DEBUG_SIM: Verify exists now: {os.path.exists(MOCK_FILE)}")
        
        # 4. Try to access the API during outage
        print("Attempting to poll during outage (expecting 500 or 404 errors)...")
        for i in range(3):
            try:
                resp = await client.get(f"{BASE_URL}/pipelines/runs/{run_id}")
                print(f"Poll {i+1}: Status {resp.status_code}")
                if resp.status_code == 200:
                    print(f"DEBUG_SIM: Response Body: {resp.text[:100]}")
            except Exception as e:
                print(f"Poll {i+1} failed as expected: {e}")
            await asyncio.sleep(2)
        
        # 5. Restore DB
        print("### RESTORING DB ###")
        if os.path.exists(BACKUP_FILE):
            shutil.move(BACKUP_FILE, MOCK_FILE)
            print("DEBUG_SIM: Restore SUCCEEDED.")
        else:
            print("DEBUG_SIM: BACKUP_FILE did not exist to restore!")
        
        # 6. Verify recovery
        print("Polling for recovery...")
        final_status = "unknown"
        for _ in range(10):
            try:
                resp = await client.get(f"{BASE_URL}/pipelines/runs/{run_id}")
                if resp.status_code == 200:
                    final_status = resp.json()["status"]
                    print(f"Recovery Poll: Status {final_status}")
                    if final_status == "completed":
                        break
            except Exception:
                pass
            await asyncio.sleep(3)
        
        if final_status == "completed":
            print("\nΓ¥î CHAOS TEST PASSED: System recovered correctly after DB restoration!")
        else:
            print(f"\nΓ¥î CHAOS TEST FINISHED: Final status is {final_status}")

if __name__ == "__main__":
    asyncio.run(run_chaos_db_test())
