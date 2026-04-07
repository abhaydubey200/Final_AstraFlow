"""
Test script to verify all API endpoints return valid responses.
Run this after starting the backend server.
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_endpoint(method, endpoint, expected_status=200):
    """Test a single endpoint and report results."""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method == "GET":
            response = requests.get(url, timeout=5)
        else:
            response = requests.post(url, timeout=5)
        
        status = "✅ PASS" if response.status_code == expected_status else "❌ FAIL"
        print(f"{status} | {method} {endpoint} | Status: {response.status_code}")
        
        # Try to parse JSON
        try:
            data = response.json()
            print(f"      Response type: {type(data).__name__}")
            if isinstance(data, list):
                print(f"      Items: {len(data)}")
            elif isinstance(data, dict):
                print(f"      Keys: {list(data.keys())[:5]}")
        except:
            print(f"      Response: {response.text[:100]}")
        
        return response.status_code == expected_status
    except requests.exceptions.ConnectionError:
        print(f"❌ ERROR | {method} {endpoint} | Backend not running")
        return False
    except Exception as e:
        print(f"❌ ERROR | {method} {endpoint} | {str(e)}")
        return False

def main():
    print("=" * 70)
    print("Testing AstraFlow API Endpoints")
    print("=" * 70)
    print()
    
    # Health check first
    print("1. Health Check:")
    test_endpoint("GET", "/health")
    print()
    
    # Test previously failing 404 endpoints
    print("2. Previously 404 Endpoints:")
    test_endpoint("GET", "/catalog/search?q=")
    test_endpoint("GET", "/catalog/search?q=test")
    test_endpoint("GET", "/self-healing/status")
    test_endpoint("GET", "/self-healing/logs")
    print()
    
    # Test previously failing 500 endpoints
    print("3. Previously 500 Endpoints:")
    test_endpoint("GET", "/monitoring/metrics")
    test_endpoint("GET", "/monitoring/worker-status")
    test_endpoint("GET", "/monitoring/audit-logs")
    print()
    
    # Test other monitoring endpoints
    print("4. Other Monitoring Endpoints:")
    test_endpoint("GET", "/monitoring/system-health")
    test_endpoint("GET", "/monitoring/notifications")
    print()
    
    print("=" * 70)
    print("Testing Complete!")
    print("=" * 70)

if __name__ == "__main__":
    main()
