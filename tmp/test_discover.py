import requests

url = "http://127.0.0.1:8081/connections/discover"
payload = {
    "type": "snowflake",
    "host": "mock",
    "database": "test",
    "warehouse": "compute_wh",
    "schema": "public",
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "target": "warehouses"
}

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
