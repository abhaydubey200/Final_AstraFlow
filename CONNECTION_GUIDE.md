# 🔗 AstraFlow - Connection & Integration Guide

## 🎯 Overview

This guide ensures your frontend, backend, and database are properly connected and operational.

---

## 📊 Connection Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │         │                 │
│   FRONTEND      │◄────────│    BACKEND      │◄────────│    SUPABASE     │
│   React + TS    │  HTTP   │  FastAPI + Py   │   SDK   │   PostgreSQL    │
│                 │         │                 │         │                 │
│ localhost:8080  │         │ localhost:8000  │         │  Cloud DB       │
└─────────────────┘         └─────────────────┘         └─────────────────┘
       │                           │                           │
       │                           │                           │
   VITE_BACKEND_URL        SUPABASE_SERVICE_ROLE_KEY    Tables & Data
   (http://localhost:8000)  (from .env)                 (pipelines, etc.)
```

---

## ✅ Pre-Flight Checklist

Before starting, verify:

### 1. Environment Variables (.env file)

```bash
# Required Backend Variables
✓ SUPABASE_URL                    # https://xxxxx.supabase.co
✓ SUPABASE_SERVICE_ROLE_KEY       # eyJhbGc... (service_role key)
✓ SUPABASE_JWT_SECRET             # Your JWT secret
✓ ASTRAFLOW_MASTER_KEY            # 64 hex characters

# Required Frontend Variables
✓ VITE_SUPABASE_URL               # Same as SUPABASE_URL
✓ VITE_SUPABASE_ANON_KEY          # eyJhbGc... (anon key)
✓ VITE_BACKEND_URL                # http://localhost:8000

# Optional (with defaults)
✓ ALLOWED_ORIGINS                 # CORS whitelist
✓ ENVIRONMENT                     # development/production
```

### 2. Database Tables

Required tables in Supabase:
- `pipelines`
- `connections`
- `pipeline_runs`
- `run_logs`
- `pipeline_nodes`
- `pipeline_edges`
- `self_healing_events`
- `worker_heartbeats`

### 3. Network Ports

Ensure these ports are available:
- `8000` - Backend API
- `8080` - Frontend UI (or 5173 for vite dev)

---

## 🧪 Testing Connectivity

### Method 1: Automated Health Check

Run the database setup script:

```bash
python setup_database.py
```

This will check:
- ✅ Environment variables configured
- ✅ Supabase connection works
- ✅ Database schema exists
- ✅ Encryption system functional

### Method 2: Manual Testing

**Step 1: Test Backend Startup**
```bash
cd backend
python -m venv venv
# Activate venv
# Windows: venv\Scripts\activate.bat
# Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Expected output:
```
✅ STARTUP: Supabase API Connectivity PASSED
✅ Auto-heal manager initialized
✅ Worker daemon started
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Step 2: Test Backend Health**
```bash
curl http://localhost:8000/health
# Expected: {"status":"healthy"}
```

**Step 3: Test API Docs**
Open browser: http://localhost:8000/docs
- Should see Swagger UI with all endpoints

**Step 4: Test Frontend Build**
```bash
npm install
npm run dev
```

Expected output:
```
VITE v5.x.x ready in xxx ms
➜  Local:   http://localhost:8080/
➜  Network: use --host to expose
```

**Step 5: Test Frontend-to-Backend Connection**

1. Open http://localhost:8080 in browser
2. Open Browser DevTools (F12) → Network tab
3. Navigate to Dashboard or Pipelines page
4. Should see successful API calls to `localhost:8000`
5. Check Console (F12) → Console tab - should be no errors

---

## 🔧 Connection Configuration Details

### Frontend → Backend Connection

**File:** `src/lib/api-client.ts`

```typescript
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

// All API calls go through this client
export const apiClient = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body: unknown) => request<T>(endpoint, { method: 'POST', body }),
  // ...
}
```

**Configuration:** Set `VITE_BACKEND_URL` in `.env`

### Backend → Database Connection

**File:** `backend/core/supabase_client.py`

```python
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(url, key)
```

**Configuration:** Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`

### CORS Configuration

**File:** `backend/main.py`

```python
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://localhost:8080"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # Must include frontend URL
    allow_credentials=True,
    # ...
)
```

**Configuration:** Set `ALLOWED_ORIGINS` in `.env` to include your frontend URL

---

## 🚨 Common Connection Issues & Fixes

### Issue 1: "Failed to fetch" in Frontend

**Symptoms:**
- Red toast notifications saying "Backend server is unreachable"
- Console error: `TypeError: Failed to fetch`

**Causes:**
1. Backend not running
2. Wrong `VITE_BACKEND_URL`
3. CORS blocking request

**Fixes:**
```bash
# 1. Verify backend is running
curl http://localhost:8000/health

# 2. Check VITE_BACKEND_URL in .env
# Should be: VITE_BACKEND_URL=http://localhost:8000

# 3. Restart frontend after changing .env
npm run dev
```

### Issue 2: CORS Errors

**Symptoms:**
- Browser console: `Access to fetch... has been blocked by CORS policy`

**Fix:**
```bash
# Add frontend URL to ALLOWED_ORIGINS in .env
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:8080

# Restart backend
```

### Issue 3: "ASTRAFLOW_MASTER_KEY not set"

**Symptoms:**
- Backend crashes on startup
- Error: `ValueError: ASTRAFLOW_MASTER_KEY environment variable is not set`

**Fix:**
```bash
# Generate encryption key
openssl rand -hex 32

# Add to .env
ASTRAFLOW_MASTER_KEY=<generated_64_char_hex>
```

### Issue 4: "Supabase connection failed"

**Symptoms:**
- Backend startup shows database connection errors
- API calls return 503 errors

**Fixes:**
```bash
# 1. Verify Supabase project is active (not paused)
# 2. Check credentials match dashboard
# 3. Verify network connectivity
# 4. Check if using service_role key (not anon key)
```

### Issue 5: "Table does not exist"

**Symptoms:**
- API returns errors about missing tables
- 404 or 500 errors from endpoints

**Fix:**
```bash
# Create tables in Supabase
# Go to: https://supabase.com/dashboard
# SQL Editor → New Query → Run table creation SQL
# See backend/database/schema.sql (if exists) or create manually
```

---

## 🔍 Debug Checklist

Use this to troubleshoot connection issues:

```bash
# ✅ Step 1: Verify .env exists
ls -la .env
# Should show .env file

# ✅ Step 2: Check backend can import dependencies
cd backend
python -c "import fastapi; print('FastAPI OK')"
python -c "from supabase import create_client; print('Supabase OK')"

# ✅ Step 3: Verify environment variables load
python -c "from dotenv import load_dotenv; import os; load_dotenv(); print('URL:', os.getenv('SUPABASE_URL'))"

# ✅ Step 4: Test Supabase connection
python setup_database.py

# ✅ Step 5: Start backend and check logs
python -m uvicorn main:app --host 0.0.0.0 --port 8000
# Look for "STARTUP: Supabase API Connectivity PASSED"

# ✅ Step 6: Test health endpoint
curl http://localhost:8000/health

# ✅ Step 7: Check frontend env
npm run dev
# Check browser console for VITE_BACKEND_URL

# ✅ Step 8: Test end-to-end
# Open http://localhost:8080
# Try creating a connection or pipeline
```

---

## 📈 Production Deployment

When deploying to production:

### 1. Update Environment Variables

```env
# Production Backend
ENVIRONMENT=production
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<prod_service_role_key>
ASTRAFLOW_MASTER_KEY=<new_production_key>
ALLOWED_ORIGINS=https://astraflow.yourdomain.com

# Production Frontend
VITE_BACKEND_URL=https://api.astraflow.yourdomain.com
VITE_SUPABASE_URL=https://your-prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=<prod_anon_key>
```

### 2. HTTPS Configuration

Ensure:
- Backend uses HTTPS (reverse proxy with nginx/caddy)
- Frontend uses HTTPS
- Update CORS to HTTPS URLs
- Update `VITE_BACKEND_URL` to HTTPS

### 3. Security Checklist

- [ ] Rotate all keys from development
- [ ] Use different Supabase project for production
- [ ] Enable Supabase Row Level Security (RLS)
- [ ] Set `ENVIRONMENT=production`
- [ ] Remove wildcard from `ALLOWED_ORIGINS`
- [ ] Set up SSL/TLS certificates
- [ ] Configure firewall rules

---

## ✅ Verification

After setup, verify:

1. **Backend Health:**
   - `curl https://api.yourdomain.com/health` → `{"status":"healthy"}`

2. **Frontend Access:**
   - Open `https://astraflow.yourdomain.com`
   - Should load without errors

3. **API Communication:**
   - Browser Network tab shows successful requests
   - No CORS errors in console

4. **Database:**
   - Pipelines can be created
   - Connections can be added
   - Data persists correctly

---

## 🎉 Success Criteria

Your application is properly connected when:

✅ Frontend loads without errors  
✅ API calls succeed (check Network tab)  
✅ Backend shows "Supabase API Connectivity PASSED"  
✅ Database operations work (create/read/update/delete)  
✅ No CORS errors in browser console  
✅ Health endpoint returns {"status":"healthy"}  
✅ Can create and run pipelines end-to-end  

---

## 📞 Need Help?

- Check [SETUP_GUIDE.md](SETUP_GUIDE.md) for installation
- Run `python setup_database.py` for automated checks
- Review backend logs for error messages
- Check browser console (F12) for frontend errors

---

**Happy orchestrating! 🚀**
