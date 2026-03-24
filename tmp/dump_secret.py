import json

store = json.load(open("backend/mock_store.json"))
secrets = store.get("connection_secrets", [])
s = {s["connection_id"]: s for s in secrets}.get("91960175-1328-4cdd-bde9-7c317ec6bd08")

with open("tmp/test_secret.json", "w") as f:
    json.dump(s, f, indent=2)
