import json
import uuid
import os

STORE_PATH = r"c:\Users\Abhay Dubey\Desktop\AstraFlow\crystal-flow-bridge\backend\mock_store.json"

def restore():
    if not os.path.exists(STORE_PATH):
        print("Store not found.")
        return

    with open(STORE_PATH, 'r') as f:
        store = json.load(f)

    pipeline_id = "e933a6ba-92fb-4a79-8b33-6a0822abb9fb"
    extract_task_id = "94e2963f-0f2a-4b52-8eae-9017b62d4686"
    load_task_id = str(uuid.uuid4())
    
    mssql_id = "e903c1b4-2d4b-4f5f-a908-eebe42549800"
    snowflake_id = "2c99cba9-0c2a-4bee-8a23-69ac924a36ad"
    
    store["pipeline_tasks"] = [
        {
            "id": extract_task_id,
            "pipeline_id": pipeline_id,
            "task_name": "Extract from MSSQL",
            "task_type": "EXTRACT",
            "config": {
                "connection_id": mssql_id,
                "table_name": "dbo.SalesData",
                "chunk_size": 10000
            }
        },
        {
            "id": load_task_id,
            "pipeline_id": pipeline_id,
            "task_name": "Load to Snowflake",
            "task_type": "LOAD",
            "config": {
                "connection_id": snowflake_id,
                "table_name": "RAW_SALES"
            }
        }
    ]
    
    # 2. Restore pipeline_dependencies
    store["pipeline_dependencies"] = [
        {
            "id": str(uuid.uuid4()),
            "pipeline_id": pipeline_id,
            "parent_task_id": extract_task_id,
            "child_task_id": load_task_id
        }
    ]
    
    # 3. Clear task_runs for this pipeline to allow re-queueing
    if "task_runs" in store:
        original_count = len(store["task_runs"])
        store["task_runs"] = [tr for tr in store["task_runs"] if tr.get("pipeline_id") != pipeline_id]
        print(f"Cleared {original_count - len(store['task_runs'])} task runs.")

    print(f"Restored tasks and dependencies for pipeline {pipeline_id}")
    
    with open(STORE_PATH, 'w') as f:
        json.dump(store, f, indent=2)

if __name__ == "__main__":
    restore()
