import requests
import json

url = "http://127.0.0.1:8081/connections/discover"
payload = {
    "id": "91960175-1328-4cdd-bde9-7c317ec6bd08",
    "name": "snowflake Connection",
    "type": "snowflake",
    "host": "HQZPZUW-MR31017",
    "port": 443,
    "database_name": "DS_GROUP_HR_DB",
    "username": "ABHAY2004",
    "ssl_enabled": False,
    "security_level": "standard",
    "created_at": "2026-03-23T10:22:47.000167",
    "updated_at": "2026-03-23T10:22:47.000525",
    "status": "connected",
    "last_tested_at": "2026-03-23T10:22:47.000525",
    "target": "warehouses"
}

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Failed: {e}")
