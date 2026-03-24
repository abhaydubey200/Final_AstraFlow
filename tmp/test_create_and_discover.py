import requests
import json
import time

base_url = "http://127.0.0.1:8081"

print("1. Creating new connection...")
create_payload = {
    "name": "Test Snow",
    "type": "snowflake",
    "host": "mock",
    "database": "test_db",
    "username": "admin",
    "password": "my_secure_password",
    "warehouse": "compute_wh"
}

try:
    c_res = requests.post(f"{base_url}/connections", json=create_payload)
    print(f"Create Status: {c_res.status_code}")
    c_data = c_res.json()
    new_id = c_data.get("id")
    print(f"New ID: {new_id}")

    if not new_id:
        print("Failed to get ID.")
        exit(1)

    print("\n2. Testing discover-schema...")
    d_payload = {
        "connection_id": new_id,
        "force_refresh": True
    }
    
    # give the async background tasks a split second
    time.sleep(1)

    d_res = requests.post(f"{base_url}/connections/discover-schema", json=d_payload)
    print(f"Discover Status: {d_res.status_code}")
    print(f"Discover Body: {d_res.text}")

except Exception as e:
    print(f"Test failed: {e}")
