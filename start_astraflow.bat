@echo off
REM =================================================================
REM ASTRAFLOW - PRODUCTION-READY STARTUP SCRIPT
REM =================================================================
REM This script starts both backend and frontend with proper checks
REM =================================================================

echo ========================================
echo   ASTRAFLOW - Starting Application
echo ========================================
echo.

REM Check if .env exists
if not exist ".env" (
    echo [ERROR] .env file not found!
    echo.
    echo Please copy .env.local to .env and configure with your credentials:
    echo   1. Copy .env.local to .env
    echo   2. Edit .env and add your Supabase credentials
    echo   3. Generate ASTRAFLOW_MASTER_KEY: openssl rand -hex 32
    echo.
    pause
    exit /b 1
)

echo [OK] Environment file found
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Please install Python 3.8+
    echo Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [OK] Python detected
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found! Please install Node.js 18+
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js detected
echo.

REM Install backend dependencies
echo ========================================
echo   Installing Backend Dependencies
echo ========================================
cd backend
if not exist "venv\" (
    echo Creating Python virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing Python packages...
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [ERROR] Failed to install backend dependencies
    pause
    exit /b 1
)

echo [OK] Backend dependencies installed
cd..
echo.

REM Install frontend dependencies
echo ========================================
echo   Installing Frontend Dependencies
echo ========================================
if not exist "node_modules\" (
    echo Installing npm packages...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend dependencies
        pause
        exit /b 1
    )
) else (
    echo [OK] Frontend dependencies already installed
)
echo.

REM Start the application
echo ========================================
echo   Starting AstraFlow Services
echo ========================================
echo.
echo Backend API will start on: http://localhost:8000
echo Frontend UI will start on: http://localhost:8080
echo.
echo Press Ctrl+C to stop all services
echo.

REM Start backend in background
echo [1/2] Starting Backend API...
cd backend
start "AstraFlow Backend" /MIN cmd /c "venv\Scripts\activate.bat && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
cd..

REM Wait a bit for backend to start
timeout /t 5 /nobreak >nul

REM Start frontend
echo [2/2] Starting Frontend UI...
start "AstraFlow Frontend" cmd /c "npm run dev"

echo.
echo ========================================
echo   AstraFlow Started Successfully!
echo ========================================
echo.
echo Access the application at:
echo   - Frontend: http://localhost:8080
echo   - Backend API: http://localhost:8000
echo   - API Docs: http://localhost:8000/docs
echo.
echo To stop: Close this window or press Ctrl+C
echo ========================================
echo.

REM Keep the window open
pause
