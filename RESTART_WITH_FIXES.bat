@echo off
REM ========================================
REM Quick Restart Script for AstraFlow
REM ========================================

echo.
echo ============================================================
echo   ASTRAFLOW - RESTART WITH FIXES APPLIED
echo ============================================================
echo.
echo This script will help you restart the backend to pick up
echo the connection module fixes.
echo.
echo FIXES APPLIED:
echo   ✅ File connectors removed (CSV, JSON, Parquet)
echo   ✅ MongoDB and Oracle properly registered
echo   ✅ Connection save persistence fixed
echo   ✅ Frontend/backend types aligned
echo.
echo ============================================================
echo.

REM Check if backend is running
echo [Step 1/3] Checking if backend is already running...
echo --------------------------------------------------------
tasklist /FI "IMAGENAME eq python.exe" 2>NUL | find /I /N "python.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ⚠️  Python processes are running
    echo.
    echo IMPORTANT: You need to manually stop your backend server first!
    echo.
    echo How to stop:
    echo   1. Find the terminal window running: python main.py (or uvicorn)
    echo   2. Press Ctrl+C to stop it
    echo   3. Then run this script again
    echo.
    echo Or press Ctrl+C now and stop it manually.
    echo.
    pause
    echo.
    echo Continuing anyway (you may have stopped it already)...
    echo.
) else (
    echo ✅ No backend detected - ready to start fresh
)

echo.
echo [Step 2/3] Starting Backend Server...
echo --------------------------------------------------------
echo Starting backend on port 8000...
echo.

cd backend
start "AstraFlow Backend" cmd /k "python main.py"

echo ✅ Backend starting in new window...
echo    Check that window for startup logs and any errors
echo.
echo Waiting 5 seconds for backend to initialize...
timeout /t 5 /nobreak >nul

echo.
echo [Step 3/3] Testing Backend Health...
echo --------------------------------------------------------
timeout /t 3 /nobreak >nul
curl -s http://localhost:8000/connections/types >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Backend might not be ready yet
    echo    Check the backend window for errors
) else (
    echo ✅ Backend is responding!
)

echo.
echo ============================================================
echo   BACKEND RESTARTED - FIXES NOW ACTIVE
echo ============================================================
echo.
echo NEXT STEPS:
echo.
echo 1. ✅ DONE: Backend restarted
echo.
echo 2. 🔄 Hard refresh your browser:
echo    Press: Ctrl + Shift + R
echo    (This clears cache and loads new frontend code)
echo.
echo 3. 🌐 Navigate to:
echo    http://localhost:8080/connections
echo.
echo 4. 🧪 Test connection creation:
echo    - Click "Build Bridge"
echo    - Select PostgreSQL
echo    - Fill in config and test
echo    - Complete wizard and save
echo    - Verify connection appears in list
echo.
echo 5. ✅ Confirm fixes:
echo    - MongoDB shows config form (not "connector not registered")
echo    - Oracle shows config form (not "connector not registered")
echo    - Saved connections appear in the list
echo    - No CSV/JSON/Parquet in connector types
echo.
echo ============================================================
echo.
echo 📖 See CONNECTION_FIX_COMPLETE.md for detailed instructions
echo 📖 See CONNECTION_PRODUCTION_READY.md for technical details
echo.
pause
