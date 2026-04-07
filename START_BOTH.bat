@echo off
REM =================================================================
REM ASTRAFLOW - START BOTH BACKEND AND FRONTEND
REM =================================================================

echo ========================================
echo   ASTRAFLOW - STARTING APPLICATION
echo ========================================
echo.

echo [1/2] Starting Backend on port 8000...
start "AstraFlow Backend" cmd /c "cd /d "%~dp0" && start_backend.bat"

echo.
echo Waiting 5 seconds for backend to initialize...
timeout /t 5 /nobreak >nul

echo.
echo [2/2] Starting Frontend on port 8080...
start "AstraFlow Frontend" cmd /c "cd /d "%~dp0" && start_frontend.bat"

echo.
echo ========================================
echo   STARTUP COMPLETE!
echo ========================================
echo.
echo Backend:  http://localhost:8000/health
echo Frontend: http://localhost:8080
echo.
echo Two windows opened:
echo   1. Backend (Python/FastAPI)
echo   2. Frontend (React/Vite)
echo.
echo Waiting 8 seconds then opening browser...
timeout /t 8 /nobreak

start http://localhost:8080

echo.
echo ========================================
echo   BROWSER OPENED
echo ========================================
echo.
echo You should see:
echo   - Dashboard with "Abhay Dubey" logged in
echo   - No login page
echo   - All sidebar menus working
echo.
echo To STOP the servers:
echo   - Close both CMD windows (Backend and Frontend)
echo.
echo Press any key to close this window...
pause >nul
