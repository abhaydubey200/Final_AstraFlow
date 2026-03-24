import json
import os

mock_file = "backend/mock_store.json"
if os.path.exists(mock_file):
    with open(mock_file, 'r') as f:
        data = json.load(f)
    
    if "pipeline_runs" in data:
        for run in data["pipeline_runs"]:
            if run.get("status") == "running":
                run["status"] = "failed"
                run["error_message"] = "Manual cleanup of stuck mock run"
    
    with open(mock_file, 'w') as f:
        json.dump(data, f, indent=2)
    print("Cleaned up stuck runs in mock_store.json")
else:
    print("mock_store.json not found")
