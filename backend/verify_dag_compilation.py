import requests
import json
import time

BASE_URL = "http://localhost:8081"
PIPELINE_ID = "bf21c85d-05ae-4202-a7a2-ad8cd4c9cec9"

def test_dag_flow():
    # 1. Update Pipeline (Triggers compile_dag)
    print(f"Updating pipeline {PIPELINE_ID}...")
    update_payload = {
        "name": "Verification_Pipeline_Compiled",
        "nodes": [
            {
                "id": "n1",
                "node_type": "source",
                "label": "Source_Node",
                "config_json": {"source_table": "users"},
                "position_x": 100,
                "position_y": 100
            },
            {
                "id": "n2",
                "node_type": "load",
                "label": "Load_Node",
                "config_json": {"target_table": "users_backup"},
                "position_x": 300,
                "position_y": 100
            }
        ],
        "edges": [
            {"source_node_id": "n1", "target_node_id": "n2"}
        ]
    }
    
    resp = requests.put(f"{BASE_URL}/pipelines/{PIPELINE_ID}", json=update_payload)
    if resp.status_code != 200:
        print(f"FAILED to update pipeline: {resp.text}")
        return
    print("Pipeline updated successfully.")

    # 2. Trigger Run
    print("Triggering run...")
    run_payload = {
        "source": {"source_table": "users"},
        "destination": {"target_table": "users_backup"}
    }
    resp = requests.post(f"{BASE_URL}/pipelines/{PIPELINE_ID}/run", json=run_payload)
    if resp.status_code != 200:
        print(f"FAILED to trigger run: {resp.text}")
        return
    
    run_data = resp.json()
    run_id = run_data["run_id"]
    print(f"Run triggered: {run_id}")

    # 3. Wait for scheduler to pick it up
    print("Waiting for scheduler to queue tasks...")
    time.sleep(10) # Scheduler polls every 5s

    print("Done. Please check mock_store.json now.")

if __name__ == "__main__":
    test_dag_flow()
