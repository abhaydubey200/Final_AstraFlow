#!/bin/bash
# =================================================================
# ASTRAFLOW - PRODUCTION-READY STARTUP SCRIPT (Unix/Linux/Mac)
# =================================================================

set -e  # Exit on error

echo "========================================"
echo "  ASTRAFLOW - Starting Application"
echo "========================================"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "[ERROR] .env file not found!"
    echo ""
    echo "Please copy .env.local to .env and configure with your credentials:"
    echo "  1. cp .env.local .env"
    echo "  2. Edit .env and add your Supabase credentials"
    echo "  3. Generate ASTRAFLOW_MASTER_KEY: openssl rand -hex 32"
    echo ""
    exit 1
fi

echo "[OK] Environment file found"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 not found! Please install Python 3.8+"
    exit 1
fi

echo "[OK] Python detected"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js not found! Please install Node.js 18+"
    exit 1
fi

echo "[OK] Node.js detected"
echo ""

# Install backend dependencies
echo "========================================"
echo "  Installing Backend Dependencies"
echo "========================================"
cd backend

if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing Python packages..."
pip install -r requirements.txt --quiet

echo "[OK] Backend dependencies installed"
cd ..
echo ""

# Install frontend dependencies
echo "========================================"
echo "  Installing Frontend Dependencies"
echo "========================================"
if [ ! -d "node_modules" ]; then
    echo "Installing npm packages..."
    npm install
else
    echo "[OK] Frontend dependencies already installed"
fi
echo ""

# Start the application
echo "========================================"
echo "  Starting AstraFlow Services"
echo "========================================"
echo ""
echo "Backend API will start on: http://localhost:8000"
echo "Frontend UI will start on: http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping AstraFlow services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend
echo "[1/2] Starting Backend API..."
cd backend
source venv/bin/activate
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 5

# Start frontend
echo "[2/2] Starting Frontend UI..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "  AstraFlow Started Successfully!"
echo "========================================"
echo ""
echo "Access the application at:"
echo "  - Frontend: http://localhost:8080"
echo "  - Backend API: http://localhost:8000"
echo "  - API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"
echo "========================================"
echo ""

# Wait for processes
wait
