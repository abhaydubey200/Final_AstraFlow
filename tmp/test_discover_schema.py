import requests

url = "http://127.0.0.1:8081/connections/discover-schema"
payload = {
    "connection_id": "91960175-1328-4cdd-bde9-7c317ec6bd08",
    "force_refresh": True
}

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
