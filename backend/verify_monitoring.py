import asyncio
import httpx
import json
import sys
import os

# Base URL for the monitoring API
BASE_URL = "http://127.0.0.1:8081/monitoring"

async def verify_monitoring():
    print("Testing Monitoring APIs...")
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        # 1. Test /metrics
        try:
            print("\n--- Testing /metrics ---")
            resp = await client.get(f"{BASE_URL}/metrics")
            if resp.status_code == 200:
                metrics = resp.json()
                print(f"Metrics: {json.dumps(metrics, indent=2)}")
                # Basic validation
                assert "totalRows" in metrics
                assert "successRate" in metrics
                assert metrics["successRate"] > 0
                print("SUCCESS: /metrics returned valid data.")
            else:
                print(f"FAILED: /metrics returned {resp.status_code}")
        except Exception as e:
            print(f"ERROR testing /metrics: {e}")

        # 2. Test /worker-status
        try:
            print("\n--- Testing /worker-status ---")
            resp = await client.get(f"{BASE_URL}/worker-status")
            if resp.status_code == 200:
                workers = resp.json()
                print(f"Workers Count: {len(workers)}")
                for w in workers:
                    print(f"Worker {w['id']}: Status={w['status']}, CPU={w['cpu']}, RAM={w['ram']}")
                # Validate that we have some workers if the simulation ran
                if len(workers) > 0:
                    print("SUCCESS: /worker-status returned active workers.")
                else:
                    print("WARNING: /worker-status returned no workers. (Is the simulation running/persisted?)")
            else:
                print(f"FAILED: /worker-status returned {resp.status_code}")
        except Exception as e:
            print(f"ERROR testing /worker-status: {e}")

        # 3. Test /queue-metrics
        try:
            print("\n--- Testing /queue-metrics ---")
            resp = await client.get(f"{BASE_URL}/queue-metrics")
            if resp.status_code == 200:
                q_metrics = resp.json()
                print(f"Queue Metrics: {json.dumps(q_metrics, indent=2)}")
                # Validate structure
                assert "pending" in q_metrics
                assert "completed" in q_metrics
                print("SUCCESS: /queue-metrics returned valid data.")
            else:
                print(f"FAILED: /queue-metrics returned {resp.status_code}")
        except Exception as e:
            print(f"ERROR testing /queue-metrics: {e}")

if __name__ == "__main__":
    asyncio.run(verify_monitoring())
