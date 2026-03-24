import requests

url = "http://127.0.0.1:8081/connections/discover"
payload = {
    "type": "snowflake",
    "host": "mock",
    "database": "test",
    "warehouse": "compute_wh",
    "schema": "public",
    "id": "e98e946a-8d7b-4171-897c-9b16c8e330c6" # Some mock id
}

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
