# 🚀 AstraFlow - Complete Application Run Commands

## 📋 Table of Contents
1. [First Time Setup](#first-time-setup)
2. [Quick Start Commands](#quick-start-commands)
3. [Individual Service Commands](#individual-service-commands)
4. [Development Commands](#development-commands)
5. [Database Commands](#database-commands)
6. [Testing Commands](#testing-commands)
7. [Docker Commands](#docker-commands)
8. [Build & Deploy Commands](#build--deploy-commands)
9. [Troubleshooting Commands](#troubleshooting-commands)

---

## 🎯 First Time Setup

### 1. Clone Repository (if not already done)
```bash
git clone https://github.com/yourusername/Final_AstraFlow.git
cd Final_AstraFlow
```

### 2. Environment Setup
```bash
# Copy environment template
copy .env.example .env

# Edit .env file with your credentials
notepad .env
```

**Required Environment Variables:**
```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Snowflake
SNOWFLAKE_ACCOUNT=your_account
SNOWFLAKE_USER=your_user
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_WAREHOUSE=your_warehouse
SNOWFLAKE_DATABASE=your_database
SNOWFLAKE_SCHEMA=your_schema

# MSSQL
MSSQL_SERVER=your_server
MSSQL_DATABASE=your_database
MSSQL_USER=your_user
MSSQL_PASSWORD=your_password

# API
API_BASE_URL=http://localhost:8000
```

### 3. Install Node.js Dependencies
```bash
# Using npm
npm install

# OR using Bun (faster)
bun install
```

### 4. Install Python Dependencies
```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Return to root
cd ..
```

### 5. Database Setup
```bash
# Setup database tables
python scripts\database\setup_database.py

# Apply migrations
python scripts\database\apply_migrations.py

# Verify database connection
python scripts\database\check_db.py
```

---

## ⚡ Quick Start Commands

### Option 1: Start Everything at Once (RECOMMENDED)
```bash
# Windows Batch Script
start_astraflow.bat

# OR Unix/Linux/Mac
chmod +x start_astraflow.sh
./start_astraflow.sh
```

### Option 2: Start Both Services
```bash
START_BOTH.bat
```

### Option 3: Quick Start
```bash
quick_start.bat
```

---

## 🔧 Individual Service Commands

### Start Frontend Only

#### Method 1: Using Batch Script
```bash
start_frontend.bat
```

#### Method 2: Using npm
```bash
# Development mode with hot reload
npm run dev

# Development mode (alternative)
npm start
```

#### Method 3: Using Bun (Faster)
```bash
bun run dev
```

**Frontend will be available at:** `http://localhost:5173`

---

### Start Backend Only

#### Method 1: Using Batch Script
```bash
start_backend.bat
```

#### Method 2: Using Python directly
```bash
# Navigate to backend
cd backend

# Activate virtual environment
venv\Scripts\activate

# Start server
python main.py

# OR using uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Backend will be available at:**
- API: `http://localhost:8000`
- API Docs (Swagger): `http://localhost:8000/docs`
- API Docs (ReDoc): `http://localhost:8000/redoc`

---

## 💻 Development Commands

### Frontend Development

```bash
# Start development server with hot reload
npm run dev

# Build for development
npm run build:dev

# Preview production build locally
npm run preview

# Run linter
npm run lint

# Fix linting issues automatically
npm run lint -- --fix

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Type check
npx tsc --noEmit
```

### Backend Development

```bash
cd backend

# Activate virtual environment
venv\Scripts\activate

# Start with auto-reload
python main.py

# Start with uvicorn (more control)
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Start with specific log level
uvicorn main:app --reload --log-level debug

# Run backend tests
pytest

# Run tests with coverage
pytest --cov=.

# Run specific test file
pytest tests\test_api.py

# Run with verbose output
pytest -v

# Deactivate virtual environment when done
deactivate
```

---

## 🗄️ Database Commands

### Database Setup & Management

```bash
# Initial database setup
python scripts\database\setup_database.py

# Apply database migrations
python scripts\database\apply_migrations.py

# Check database health
python scripts\database\check_db.py

# Check database keys/credentials
python scripts\database\check_keys.py

# Check connection pooling
python scripts\database\check_pooling.py

# Check registry schemas
python scripts\database\check_registry_schemas.py
```

### Snowflake Specific

```bash
# Check Snowflake version
python scripts\database\check_snowflake_version.py

# Debug Snowflake connection
python scripts\database\debug_snowflake.py

# Test Snowflake fallback
python scripts\testing\test_snowflake_fallback.py
```

### MSSQL Specific

```bash
# Check MSSQL data
python scripts\database\check_mssql_data.py

# Check MSSQL registry
python scripts\database\check_mssql_registry.py

# Test MSSQL instantiation
python scripts\testing\test_mssql_instantiation.py
```

### Supabase Specific

```bash
# Check Supabase health
python scripts\database\check_supabase_health.py

# Test Supabase connection
python scripts\testing\test_supabase_connection.py
```

---

## 🧪 Testing Commands

### Frontend Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test -- --coverage

# Run specific test file
npm run test -- src/components/Button.test.tsx
```

### Backend Tests

```bash
cd backend
venv\Scripts\activate

# Run all tests
pytest

# Run with coverage
pytest --cov

# Run specific test file
pytest tests\test_api.py

# Run specific test function
pytest tests\test_api.py::test_health_check

# Run with verbose output
pytest -v

# Run and stop at first failure
pytest -x
```

### Integration & System Tests

```bash
# Audit test
python scripts\testing\audit_test.py

# Deep audit
python scripts\testing\deep_audit.py

# Load test analysis
python scripts\testing\analyze_load_test.py

# Test IPv6 connectivity
python scripts\testing\test_ipv6.py
```

---

## 🐳 Docker Commands

### Start with Docker Compose

```bash
# Start all services
docker-compose up

# Start in detached mode (background)
docker-compose up -d

# Build and start
docker-compose up --build

# Start specific service
docker-compose up frontend
docker-compose up backend
```

### Docker Management

```bash
# View logs
docker-compose logs

# Follow logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f frontend
docker-compose logs -f backend

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Restart services
docker-compose restart

# View running containers
docker-compose ps

# Execute command in container
docker-compose exec frontend sh
docker-compose exec backend bash
```

### Docker Build Commands

```bash
# Build frontend image
docker build -f Dockerfile.frontend -t astraflow-frontend .

# Build backend image (if you have one)
docker build -f backend/Dockerfile -t astraflow-backend ./backend

# Run frontend container manually
docker run -p 5173:5173 astraflow-frontend

# Run backend container manually
docker run -p 8000:8000 astraflow-backend
```

---

## 📦 Build & Deploy Commands

### Production Build

```bash
# Build frontend for production
npm run build

# Build output will be in: dist/

# Preview production build
npm run preview
```

### Production Server

```bash
# Serve production build with nginx
# (Configure nginx.conf first)
nginx -c nginx.conf

# OR using a simple HTTP server
npx serve -s dist -l 3000
```

### Backend Production

```bash
cd backend
venv\Scripts\activate

# Install production server
pip install gunicorn

# Run with gunicorn (Linux/Mac)
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker

# Windows alternative (use waitress)
pip install waitress
waitress-serve --port=8000 main:app
```

---

## 🛠️ Troubleshooting Commands

### Check System Status

```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Check Python version
python --version

# Check pip version
pip --version

# Check Git version
git --version
```

### Check Application Health

```bash
# Check database connection
python scripts\database\check_db.py

# Health check script
python scripts\database\check_supabase_health.py

# Verify environment variables
python scripts\database\check_keys.py
```

### Clear Cache & Reinstall

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rmdir /s /q node_modules
del package-lock.json
npm install

# Clear Python cache
cd backend
rmdir /s /q __pycache__
rmdir /s /q .pytest_cache
```

### View Logs

```bash
# Frontend dev server logs (shown in terminal)
npm run dev

# Backend logs
cd backend
python main.py

# View saved logs
type logs\tests\test_out.txt
type logs\performance\perf_output.txt
type logs\security\security_report.txt
```

### Network & Port Check

```bash
# Check if port 5173 is in use (frontend)
netstat -ano | findstr :5173

# Check if port 8000 is in use (backend)
netstat -ano | findstr :8000

# Kill process on port (replace PID)
taskkill /PID <process_id> /F
```

---

## 🔍 Development Tools Commands

### Linting

```bash
# Run ESLint
npm run lint

# Run custom TypeScript linter
node tools\linters\custom_ts_linter.cjs

# Run deep TypeScript linter
node tools\linters\custom_ts_linter_deep.cjs
```

### Security Scanning

```bash
# Run security scanner
node tools\scanners\security_scanner.cjs

# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix
```

### Code Quality

```bash
# Format code with Prettier (if configured)
npx prettier --write src/

# Type checking
npx tsc --noEmit

# Bundle size analysis
npm run build -- --analyze
```

---

## 📊 Monitoring Commands

### Performance Monitoring

```bash
# Run performance tests
python scripts\testing\analyze_load_test.py

# Check performance logs
type logs\performance\perf_output.txt
```

### Database Monitoring

```bash
# Monitor connection pooling
python scripts\database\check_pooling.py

# Check registry schemas
python scripts\database\check_registry_schemas.py
```

---

## 🚀 Complete Startup Sequence

### Full Development Setup (First Time)

```bash
# 1. Setup environment
copy .env.example .env
notepad .env

# 2. Install dependencies
npm install
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cd ..

# 3. Setup database
python scripts\database\setup_database.py
python scripts\database\apply_migrations.py

# 4. Verify setup
python scripts\database\check_db.py

# 5. Start application
start_astraflow.bat
```

### Daily Development Startup

```bash
# Just run this!
start_astraflow.bat

# OR start services separately in different terminals

# Terminal 1 - Frontend
npm run dev

# Terminal 2 - Backend
cd backend
venv\Scripts\activate
python main.py
```

---

## 📱 Access URLs

After starting the application:

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:5173 | Main application UI |
| **Backend API** | http://localhost:8000 | REST API |
| **API Docs (Swagger)** | http://localhost:8000/docs | Interactive API documentation |
| **API Docs (ReDoc)** | http://localhost:8000/redoc | Alternative API documentation |
| **Health Check** | http://localhost:8000/health | API health endpoint |

---

## ✅ Verification Commands

### Verify Installation

```bash
# Check frontend dependencies
npm list

# Check backend dependencies
cd backend
venv\Scripts\activate
pip list

# Run health checks
python scripts\database\check_db.py
python scripts\database\check_supabase_health.py
```

### Verify Application is Running

```bash
# Check frontend
curl http://localhost:5173

# Check backend health
curl http://localhost:8000/health

# Check API docs
start http://localhost:8000/docs
```

---

## 🎯 Common Workflows

### Start Development Session
```bash
# 1. Pull latest changes
git pull

# 2. Install any new dependencies
npm install
cd backend && pip install -r requirements.txt && cd ..

# 3. Start application
start_astraflow.bat
```

### Before Committing Code
```bash
# 1. Run linter
npm run lint

# 2. Run tests
npm run test
cd backend && pytest && cd ..

# 3. Build
npm run build

# 4. Commit
git add .
git commit -m "Your message"
git push
```

### Update Dependencies
```bash
# Update npm packages
npm update

# Update Python packages
cd backend
venv\Scripts\activate
pip install --upgrade -r requirements.txt
```

---

## 💡 Pro Tips

### Use Multiple Terminals

**Terminal 1 - Frontend:**
```bash
npm run dev
```

**Terminal 2 - Backend:**
```bash
cd backend
venv\Scripts\activate
python main.py
```

**Terminal 3 - Tests:**
```bash
npm run test:watch
```

### Quick Restart

If you need to restart quickly:

```bash
# Stop with Ctrl+C in both terminals, then:

# Frontend
npm run dev

# Backend (if already in backend dir with venv active)
python main.py
```

### Environment-Specific Commands

```bash
# Development
npm run dev

# Production preview
npm run build && npm run preview

# Docker production
docker-compose -f docker-compose.prod.yml up
```

---

## 🆘 Emergency Commands

### Application Won't Start

```bash
# 1. Kill all node processes
taskkill /F /IM node.exe

# 2. Kill all python processes
taskkill /F /IM python.exe

# 3. Clear ports
netstat -ano | findstr :5173
netstat -ano | findstr :8000
# Then kill those processes

# 4. Clean install
rmdir /s /q node_modules
npm install

# 5. Try again
start_astraflow.bat
```

### Database Connection Issues

```bash
# 1. Verify credentials
python scripts\database\check_keys.py

# 2. Check connection
python scripts\database\check_db.py

# 3. Reinitialize
python scripts\database\setup_database.py
```

---

## 📚 Additional Resources

- **Setup Guide:** `docs\SETUP_GUIDE.md`
- **Quick Reference:** `QUICK_REFERENCE.txt`
- **Project Structure:** `PROJECT_STRUCTURE.md`
- **Emergency Fix:** `docs\EMERGENCY_FIX.md`
- **Connection Guide:** `docs\CONNECTION_GUIDE.md`

---

<div align="center">

**🎉 You're Ready to Run AstraFlow! 🎉**

Start with: `start_astraflow.bat`

</div>
