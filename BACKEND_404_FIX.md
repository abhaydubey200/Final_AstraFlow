# 🔥 URGENT: Backend API 404 Errors

## Problem
You're seeing 404 errors for:
- `GET http://localhost:8000/pipelines` 
- `GET http://localhost:8000/connections`
- `GET http://localhost:8000/pipelines/runs`

## Root Cause
**The backend server is either:**
1. Not running at all
2. Not properly started after our changes
3. Failed to import routers due to dependency errors

## ✅ SOLUTION: Restart Backend Properly

### Step 1: Stop Any Running Backend
```bash
# Find and kill any Python processes
# In Windows: Open Task Manager → Find "python.exe" → End Task
# OR just close the terminal window running the backend
```

### Step 2: Start Backend Fresh
```bash
# Option A: Use the restart script
RESTART_WITH_FIXES.bat

# Option B: Manual start
cd backend
python main.py
```

### Step 3: Watch for Startup Messages
You should see:
```
✅ AstraFlow Backend - SIMPLE MODE (No blocking dependencies)
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Step 4: Verify API is Working
Run the diagnostic script:
```bash
diagnose_backend.bat
```

This will test all endpoints and show you exactly what's working.

---

## 🔍 Quick Health Check

Open browser and go to:
```
http://localhost:8000/health
```

**Expected result:**
```json
{
  "status": "online",
  "version": "3.0.0-stable",
  "mode": "single-admin",
  "user": "dubeyabhay430@gmail.com"
}
```

**If you get an error:** Backend is NOT running!

---

## 🐛 Troubleshooting

### Backend Won't Start - Import Errors
If you see errors like:
```
ImportError: cannot import name 'XXX'
ModuleNotFoundError: No module named 'XXX'
```

**Fix:**
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### Backend Starts But Routes Return 404
This means routers failed to import. Check backend terminal for errors.

**Common causes:**
- Missing dependencies in `services/`
- Syntax errors in router files
- Missing `__init__.py` files

**Quick check:**
```bash
cd backend
python -c "from api.pipeline_router import router; print('Pipeline router OK')"
python -c "from api.connection_router import router; print('Connection router OK')"
```

### Port Already in Use
If you see:
```
OSError: [WinError 10048] Only one usage of each socket address is normally permitted
```

**Fix:**
```bash
# Find process using port 8000
netstat -ano | findstr :8000

# Kill it (replace PID with actual number)
taskkill /PID <PID> /F

# Then start backend again
cd backend
python main.py
```

---

## 📋 Verification Checklist

After restarting backend, verify:
- [ ] Terminal shows "Uvicorn running on http://0.0.0.0:8000"
- [ ] http://localhost:8000/health returns 200
- [ ] http://localhost:8000/connections returns 200 (empty array OK)
- [ ] http://localhost:8000/connections/types returns 200 with 6 connectors
- [ ] http://localhost:8000/pipelines returns 200 (empty array OK)
- [ ] Browser console shows NO 404 errors

---

## ⚡ Quick Fix Commands

Copy and paste this entire block:
```bash
REM Stop any running backend
taskkill /F /IM python.exe 2>nul

REM Wait 2 seconds
timeout /t 2 /nobreak >nul

REM Start fresh
cd backend
start "AstraFlow Backend" cmd /k "python main.py"

REM Wait for startup
timeout /t 5 /nobreak >nul

REM Test health
curl http://localhost:8000/health
```

---

## 🎯 What Should Happen

**1. Backend Terminal Should Show:**
```
✅ AstraFlow Backend - SIMPLE MODE
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

**2. Browser Console Should Show:**
- ✅ 200 responses for /connections
- ✅ 200 responses for /pipelines  
- ✅ 200 responses for /connections/types
- ❌ NO 404 errors

**3. Connection Page Should:**
- Load without errors
- Show "Build Bridge" button
- Type filter has 6 options
- Can click "Build Bridge" and see connectors

---

## 🆘 Still Not Working?

If backend still won't start or returns 404s:

1. **Check Python version:**
   ```bash
   python --version
   # Should be 3.9+
   ```

2. **Reinstall dependencies:**
   ```bash
   cd backend
   pip install --upgrade -r requirements.txt
   ```

3. **Check for syntax errors:**
   ```bash
   cd backend
   python -m py_compile main.py
   python -m py_compile api/pipeline_router.py
   python -m py_compile api/connection_router.py
   ```

4. **Run in debug mode:**
   ```bash
   cd backend
   python main.py --reload
   ```

5. **Check backend logs:**
   Look for any red error messages in the terminal where backend is running

---

## 📞 Emergency Fallback

If nothing works, try this minimal test:
```bash
cd backend
python -c "
from fastapi import FastAPI
app = FastAPI()

@app.get('/test')
def test():
    return {'status': 'ok'}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8001)
"
```

Then check: http://localhost:8001/test

If this works but your main backend doesn't, there's an import error in main.py or routers.

---

**TL;DR:** Backend is not running. Run `RESTART_WITH_FIXES.bat` or manually restart backend server.
