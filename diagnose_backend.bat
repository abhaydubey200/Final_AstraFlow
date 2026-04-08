@echo off
REM ========================================
REM Backend API Diagnostics
REM ========================================

echo.
echo ============================================================
echo   ASTRAFLOW BACKEND API DIAGNOSTICS
echo ============================================================
echo.

echo [1/5] Checking if backend is running...
echo --------------------------------------------------------
curl -s http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
    echo ❌ FAILED: Backend is NOT responding on port 8000
    echo.
    echo PROBLEM: The backend server is not running!
    echo.
    echo SOLUTION:
    echo   1. Open a new terminal
    echo   2. cd backend
    echo   3. python main.py
    echo.
    echo    OR use: RESTART_WITH_FIXES.bat
    echo.
    pause
    exit /b 1
) else (
    echo ✅ PASSED: Backend is running
    curl -s http://localhost:8000/health
    echo.
)

echo.
echo [2/5] Testing /connections endpoint...
echo --------------------------------------------------------
curl -s -o nul -w "HTTP Status: %%{http_code}\n" http://localhost:8000/connections
curl -s http://localhost:8000/connections

echo.
echo [3/5] Testing /connections/types endpoint...
echo --------------------------------------------------------
curl -s -o nul -w "HTTP Status: %%{http_code}\n" http://localhost:8000/connections/types
echo Connector types available:
curl -s http://localhost:8000/connections/types | python -m json.tool 2>nul | findstr /C:"postgresql" /C:"mysql" /C:"mongodb" /C:"oracle"

echo.
echo [4/5] Testing /pipelines endpoint...
echo --------------------------------------------------------
curl -s -o nul -w "HTTP Status: %%{http_code}\n" http://localhost:8000/pipelines

echo.
echo [5/5] Testing /pipelines/runs endpoint...
echo --------------------------------------------------------
curl -s -o nul -w "HTTP Status: %%{http_code}\n" http://localhost:8000/pipelines/runs

echo.
echo ============================================================
echo   DIAGNOSIS COMPLETE
echo ============================================================
echo.
echo EXPECTED RESULTS:
echo   ✅ /health should return 200
echo   ✅ /connections should return 200 (or empty array)
echo   ✅ /connections/types should return 200 with 6 connectors
echo   ✅ /pipelines should return 200 (or empty array)
echo   ✅ /pipelines/runs should return 200 (or empty array)
echo.
echo If you see 404 errors:
echo   1. Backend might not be running - check terminal
echo   2. Routers might have import errors - check backend logs
echo   3. Try restarting: RESTART_WITH_FIXES.bat
echo.
pause
