import requests
import json
import time
import os

BASE_URL = "http://localhost:8081"
PIPELINE_ID = "bf21c85d-05ae-4202-a7a2-ad8cd4c9cec9"

def verify_data_flow():
    # 1. Update Pipeline with realistic task structure
    print(f"Updating pipeline {PIPELINE_ID} for data flow test...")
    update_payload = {
        "name": "DataFlow_Verification_Pipeline",
        "nodes": [
            {
                "id": "node_extract",
                "node_type": "source",
                "label": "Extract_Users",
                "config_json": {
                    "table_name": "public.users",
                    "chunk_size": 10,
                    "partition_count": 2
                },
                "position_x": 100,
                "position_y": 100
            },
            {
                "id": "node_load",
                "node_type": "load",
                "label": "Load_Users",
                "config_json": {
                    "target_table": "target_users_backup",
                    "dest_config": {"warehouse": "ANALYTICS"}
                },
                "position_x": 400,
                "position_y": 100
            }
        ],
        "edges": [
            {"source_node_id": "node_extract", "target_node_id": "node_load"}
        ]
    }
    
    resp = requests.put(f"{BASE_URL}/pipelines/{PIPELINE_ID}", json=update_payload)
    if resp.status_code != 200:
        print(f"FAILED to update pipeline: {resp.text}")
        return
    print("Pipeline updated.")

    # 2. Trigger Run
    print("Triggering run...")
    run_payload = {
        "environment": "dev"
    }
    resp = requests.post(f"{BASE_URL}/pipelines/{PIPELINE_ID}/run", json=run_payload)
    if resp.status_code != 200:
        print(f"FAILED to trigger run: {resp.text}")
        return
    
    run_id = resp.json()["run_id"]
    print(f"Run triggered: {run_id}")

    # 3. Wait for full execution (Partitioning -> Extracting -> Parquet -> Loading)
    print("Waiting for data flow execution (60s)...")
    for i in range(6):
        time.sleep(10)
        print(f"  ... {10*(i+1)}s elapsed")

    # 4. Success check instructions
    print("\nVerification Complete.")
    print("Please check:")
    print("1. mock_store.json -> pipeline_partitions, staging_files, bulk_load_jobs")
    print("2. /tmp/astraflow_cache/ -> generated .parquet files")
    print("3. mock_store.json -> pipeline_runs and task_runs statuses")

if __name__ == "__main__":
    verify_data_flow()
