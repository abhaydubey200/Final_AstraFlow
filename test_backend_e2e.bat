@echo off
REM AstraFlow Backend E2E API Tests
REM Tests all critical connection endpoints

echo ==========================================
echo ASTRAFLOW BACKEND E2E TESTS
echo ==========================================
echo.

set BACKEND_URL=http://localhost:8000

echo [TEST 1] Health Check
curl -s %BACKEND_URL%/health
echo.
echo.

echo [TEST 2] List Connection Types
curl -s %BACKEND_URL%/connections/types
echo.
echo.

echo [TEST 3] List Connections (Empty)
curl -s %BACKEND_URL%/connections
echo.
echo.

echo [TEST 4] Test Connection (Expected Failure - Demo Credentials)
curl -s -X POST %BACKEND_URL%/connections/test ^
  -H "Content-Type: application/json" ^
  -d "{\"type\":\"postgresql\",\"host\":\"localhost\",\"port\":5432,\"username\":\"demo\",\"password\":\"demo\",\"database\":\"demo\"}"
echo.
echo.

echo [TEST 5] Create Connection
curl -s -X POST %BACKEND_URL%/connections ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"Test PostgreSQL\",\"type\":\"postgresql\",\"host\":\"demo.db.com\",\"port\":5432,\"username\":\"testuser\",\"password\":\"testpass\",\"database_name\":\"testdb\",\"ssl_enabled\":false}"
echo.
echo.

echo ==========================================
echo E2E TESTS COMPLETE
echo ==========================================
echo.
echo INSTRUCTIONS:
echo 1. Start backend: cd backend ^&^& uvicorn main:app --reload --port 8000
echo 2. Run this script again
echo 3. Verify all responses contain {"success": true/false}
echo 4. Verify no passwords are exposed in responses
echo.
pause
