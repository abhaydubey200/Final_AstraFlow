@echo off
REM =================================================================
REM ASTRAFLOW - QUICK START (SINGLE ADMIN MODE)
REM =================================================================

echo ========================================
echo   ASTRAFLOW - Quick Start
echo ========================================
echo.

echo Starting Backend on port 8000...
start "AstraFlow Backend" cmd /k "cd backend && python main.py"

echo Waiting 5 seconds for backend to start...
timeout /t 5 /nobreak >nul

echo.
echo Starting Frontend on port 8080...
start "AstraFlow Frontend" cmd /k "npm run dev"

echo.
echo ========================================
echo   STARTUP COMPLETE
echo ========================================
echo.
echo Backend:  http://localhost:8000/health
echo Frontend: http://localhost:8080
echo.
echo Press any key to open browser...
pause >nul

start http://localhost:8080

echo.
echo Both windows are running in background.
echo Close those CMD windows to stop the servers.
echo.
pause
