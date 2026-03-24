
import json
import os

filepath = r"c:\Users\Abhay Dubey\Desktop\AstraFlow\crystal-flow-bridge\backend\mock_store.json"

if not os.path.exists(filepath):
    print(f"Error: {filepath} not found")
    exit(1)

with open(filepath, 'r') as f:
    store = json.load(f)

pipelines = store.get("pipelines", [])
runs = store.get("pipeline_runs", [])
tasks = store.get("task_runs", [])

print(f"Total Pipelines: {len(pipelines)}")
print(f"Total Runs: {len(runs)}")
print(f"Total Task Runs: {len(tasks)}")

run_statuses = {}
for r in runs:
    status = r.get("status", "unknown")
    run_statuses[status] = run_statuses.get(status, 0) + 1

task_statuses = {}
for t in tasks:
    status = t.get("status", "unknown")
    task_statuses[status] = task_statuses.get(status, 0) + 1

print("\nPipeline Run Statuses:")
for s, count in run_statuses.items():
    print(f"  {s}: {count}")

print("\nTask Run Statuses:")
for s, count in task_statuses.items():
    print(f"  {s}: {count}")

if len(runs) > 0 and run_statuses.get("completed", 0) == len(runs):
    print("\nSUCCESS: All runs completed!")
else:
    print("\nSome runs are not completed.")
