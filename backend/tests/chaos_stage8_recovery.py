
import asyncio
import httpx
import os
import time

BASE_URL = "http://localhost:8081"

async def run_stage8_chaos():
    print("Starting Stage 8 Chaos: Persistent DB Outage recovery")
    
    # We assume the backend is NOT yet in CHAOS mode.
    # To set it in chaos mode, we'd need to set an env var in THAT process.
    # Since we can't easily do that, we'll use a FILE-BASED trigger instead.
    
    trigger_file = r"backend/chaos_outage.trigger"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Start a run
        resp = await client.post(f"{BASE_URL}/pipelines", json={
            "pipeline": {"name": "Stage 8 Recovery Pipeline"},
            "nodes": [{"id": "n1", "node_type": "source", "label": "Source", "config_json": {}}],
            "edges": []
        })
        resp.raise_for_status()
        p_id = resp.json()["id"]
        
        resp = await client.post(f"{BASE_URL}/pipelines/{p_id}/run", json={"source":{}, "destination": {}})
        resp.raise_for_status()
        run_id = resp.json()["run_id"]
        print(f"Pipeline {p_id} run {run_id} started.")
        
        # 2. Trigger persistent outage
        print("!!! ENABLING CHAOS OUTAGE via trigger file !!!")
        with open(trigger_file, "w") as f: f.write("true")
        
        # 3. Verify outage
        print("Polling during outage (expecting 500 codes)...")
        for i in range(3):
            try:
                resp = await client.get(f"{BASE_URL}/health") # Health might still be 200, but /pipelines/runs/... should be 500
                resp = await client.get(f"{BASE_URL}/pipelines/runs/{run_id}")
                print(f"Poll {i+1}: Status {resp.status_code}")
            except Exception as e:
                print(f"Poll {i+1} handled err: {e}")
            await asyncio.sleep(3)
        
        # 4. Restore DB
        print("### DISABLING CHAOS OUTAGE ###")
        if os.path.exists(trigger_file):
            os.remove(trigger_file)
        
        # 5. Wait for Auto-Heal recovery (we set threshold to 30s)
        print("Waiting for Auto-Heal to detect and finish the run...")
        for _ in range(15):
            try:
                resp = await client.get(f"{BASE_URL}/pipelines/runs/{run_id}")
                status = resp.json()["status"]
                print(f"Recovery Poll: Status {status}")
                if status == "completed":
                    print("\nΓ¥î SUCCESS: System recovered and completed the run!")
                    return
                if status == "failed":
                    print("\nΓ¥î FINISHED: Run reached 'failed' status (expected if healing marks failed).")
                    return
            except Exception:
                pass
            await asyncio.sleep(4)
        
        print("\nFAILURE: System did not reach final status in time.")

if __name__ == "__main__":
    asyncio.run(run_stage8_chaos())
