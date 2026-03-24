import requests
import json

try:
    response = requests.get("http://127.0.0.1:8081/connections")
    data = response.json()
    with open("tmp/conns.json", "w") as f:
        json.dump(data, f, indent=2)
except Exception as e:
    print(f"Failed: {e}")
