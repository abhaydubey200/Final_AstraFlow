@echo off
REM ========================================
REM Complete Application Startup Script
REM ========================================

echo.
echo ============================================================
echo   ASTRAFLOW - COMPLETE STARTUP GUIDE
echo ============================================================
echo.
echo This script will help you start both backend and frontend
echo with all connection page fixes applied.
echo.
echo ============================================================
echo.

REM Step 1: Check if backend is already running
echo [Step 1/5] Checking for existing backend processes...
echo --------------------------------------------------------
tasklist /FI "IMAGENAME eq python.exe" 2>NUL | find /I /N "python.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ⚠️  Python processes detected
    echo.
    echo Please manually stop your backend server:
    echo   - Find terminal running: python main.py
    echo   - Press Ctrl+C to stop
    echo   - Or use Task Manager to end python.exe
    echo.
    choice /C YN /M "Have you stopped the backend? (Y/N)"
    if errorlevel 2 exit /b 1
)

echo.
echo [Step 2/5] Verifying backend files...
echo --------------------------------------------------------
if not exist "backend\main.py" (
    echo ❌ ERROR: backend\main.py not found!
    echo    Make sure you're running this from project root.
    pause
    exit /b 1
)
echo ✅ Backend files found

echo.
echo [Step 3/5] Starting Backend Server...
echo --------------------------------------------------------
echo Starting on port 8000...
cd backend
start "AstraFlow Backend" cmd /k "python main.py"
cd ..

echo ✅ Backend starting in new window
echo    Check that window for:
echo    - "Uvicorn running on http://0.0.0.0:8000"
echo    - No red error messages
echo.

echo Waiting 8 seconds for backend to initialize...
timeout /t 8 /nobreak >nul

echo.
echo [Step 4/5] Testing Backend Health...
echo --------------------------------------------------------
curl -s http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Backend not responding yet
    echo    Check the backend window for errors
    echo.
    echo Common issues:
    echo    - Port 8000 already in use
    echo    - Missing dependencies: pip install -r requirements.txt
    echo    - Python not in PATH
    echo.
) else (
    echo ✅ Backend is responding!
    curl -s http://localhost:8000/health
    echo.
)

echo.
echo [Step 5/5] Testing API Endpoints...
echo --------------------------------------------------------
echo Testing /connections...
curl -s -o nul -w "  Status: %%{http_code}\n" http://localhost:8000/connections

echo Testing /connections/types...
curl -s -o nul -w "  Status: %%{http_code}\n" http://localhost:8000/connections/types

echo Testing /pipelines...
curl -s -o nul -w "  Status: %%{http_code}\n" http://localhost:8000/pipelines

echo Testing /pipelines/runs...
curl -s -o nul -w "  Status: %%{http_code}\n" http://localhost:8000/pipelines/runs

echo.
echo ============================================================
echo   STARTUP COMPLETE
echo ============================================================
echo.
echo NEXT STEPS:
echo.
echo 1. ✅ Backend is running in separate window
echo.
echo 2. 🌐 Open your browser to:
echo    http://localhost:8080
echo    (Make sure frontend dev server is also running)
echo.
echo 3. 🔄 Hard refresh browser:
echo    Press: Ctrl + Shift + R
echo.
echo 4. 📍 Navigate to Connections page:
echo    http://localhost:8080/connections
echo.
echo 5. ✅ Verify fixes:
echo    - No 404 errors in browser console
echo    - Page loads successfully
echo    - Type filter shows 6 database types
echo    - MongoDB and Oracle are selectable
echo    - Can create connections that save properly
echo.
echo ============================================================
echo.
echo 📖 Documentation:
echo    - CONNECTION_FIX_COMPLETE.md - User guide
echo    - CONNECTION_PRODUCTION_READY.md - Technical details  
echo    - BACKEND_404_FIX.md - Troubleshooting 404 errors
echo.
echo 🔧 Diagnostic tools:
echo    - diagnose_backend.bat - Test all endpoints
echo    - validate_connection_fixes.bat - Verify code changes
echo.
echo ============================================================
pause
