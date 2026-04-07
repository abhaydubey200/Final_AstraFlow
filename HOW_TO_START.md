# 🚀 START ASTRAFLOW NOW - VISUAL GUIDE

## ✨ SUPER EASY METHOD (RECOMMENDED)

### Just Double-Click This File:
```
START_BOTH.bat
```

**That's it!** The script will:
1. ✅ Start backend on port 8000
2. ✅ Start frontend on port 8080
3. ✅ Open browser automatically
4. ✅ Show you the Dashboard

---

## 📋 STEP-BY-STEP (What Happens)

### When You Double-Click `START_BOTH.bat`:

**Step 1: Backend Starts**
- A CMD window opens with title "AstraFlow Backend"
- You'll see:
  ```
  ✅ AstraFlow Backend - SIMPLE MODE (No blocking dependencies)
  🚀 AstraFlow Starting (Degraded Mode Enabled)...
  ✅ Backend ready on port 8000
  INFO:     Uvicorn running on http://0.0.0.0:8000
  ```
- **Leave this window OPEN!**

**Step 2: Frontend Starts (after 5 seconds)**
- Another CMD window opens with title "AstraFlow Frontend"
- You'll see:
  ```
  VITE v5.x.x  ready in XXX ms
  
  ➜  Local:   http://localhost:8080/
  ➜  Network: use --host to expose
  ```
- **Leave this window OPEN too!**

**Step 3: Browser Opens (after 8 seconds)**
- Your default browser opens to http://localhost:8080
- You should see the **Dashboard** immediately
- No login page!
- "Abhay Dubey" shown in top-right corner

---

## ✅ SUCCESS CHECKLIST

### You'll Know It's Working When:
- [ ] Two CMD windows are open (Backend + Frontend)
- [ ] Backend window shows "Uvicorn running on http://0.0.0.0:8000"
- [ ] Frontend window shows "Local: http://localhost:8080/"
- [ ] Browser opens to Dashboard
- [ ] You see "Abhay Dubey" or user info in top-right
- [ ] Sidebar shows all menu items (Pipelines, Connections, etc.)
- [ ] No error messages in browser

---

## 🔍 HOW TO VERIFY IT'S WORKING

### Test #1: Backend Health Check
Open in browser: **http://localhost:8000/health**

Should show:
```json
{
  "status": "online",
  "version": "3.0.0-stable",
  "mode": "single-admin",
  "user": "dubeyabhay430@gmail.com"
}
```

### Test #2: Backend API Documentation
Open in browser: **http://localhost:8000/docs**

Should show:
- FastAPI interactive documentation (Swagger UI)
- List of all endpoints

### Test #3: Frontend Dashboard
Open in browser: **http://localhost:8080**

Should show:
- Dashboard page with cards
- Sidebar with menu items
- "Abhay Dubey" or user info visible
- No login page

### Test #4: Browser Console (Press F12)
Should show:
- No red errors
- Maybe some warnings (okay for now)
- No "ERR_CONNECTION_REFUSED"
- No CORS errors

---

## 🛑 HOW TO STOP THE SERVERS

### Method 1: Close CMD Windows
1. Go to the "AstraFlow Backend" CMD window
2. Click the X button or press Ctrl+C
3. Go to the "AstraFlow Frontend" CMD window
4. Click the X button or press Ctrl+C

### Method 2: Use Task Manager
1. Press Ctrl+Shift+Esc
2. Find "python.exe" (Backend)
3. Right-click → End Task
4. Find "node.exe" (Frontend)
5. Right-click → End Task

---

## ❌ TROUBLESHOOTING

### Problem: "Python not found"
**Solution:**
```bash
# Try one of these:
python --version
python3 --version
py --version

# If none work, install Python 3.8+ from:
https://www.python.org/downloads/
```

### Problem: "npm not found"
**Solution:**
```bash
# Check if Node.js is installed:
node --version

# If not installed, download from:
https://nodejs.org/
```

### Problem: Backend shows error about missing packages
**Solution:**
```bash
cd backend
pip install -r requirements.txt
```

### Problem: Frontend shows error about missing packages
**Solution:**
```bash
npm install
```

### Problem: Port 8000 already in use
**Solution:**
```bash
# Find what's using port 8000:
netstat -ano | findstr :8000

# Kill that process (replace XXXX with PID):
taskkill /PID XXXX /F
```

### Problem: Port 8080 already in use
**Solution:**
```bash
# Find what's using port 8080:
netstat -ano | findstr :8080

# Kill that process (replace XXXX with PID):
taskkill /PID XXXX /F
```

### Problem: Backend starts but shows errors in window
**Solutions:**
1. Check if `.env` file exists in root directory
2. Make sure you're in the correct directory
3. Copy the full error message and share with me

### Problem: Frontend shows white screen
**Solutions:**
1. Open browser console (F12 → Console tab)
2. Check if backend is running: http://localhost:8000/health
3. Look for error messages in console
4. Share the error message with me

---

## 📸 WHAT YOU SHOULD SEE

### Backend Window:
```
========================================
  ASTRAFLOW BACKEND - Starting...
========================================

Port: 8000
Mode: Single Admin (Degraded Mode)
User: dubeyabhay430@gmail.com

✅ AstraFlow Backend - SIMPLE MODE (No blocking dependencies)
🚀 AstraFlow Starting (Degraded Mode Enabled)...
✅ Backend ready on port 8000
INFO:     Started server process [XXXX]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

### Frontend Window:
```
========================================
  ASTRAFLOW FRONTEND - Starting...
========================================

Port: 8080
Backend: http://localhost:8000

> astraflow@0.0.0.0 dev
> vite

  VITE v5.4.11  ready in 1234 ms

  ➜  Local:   http://localhost:8080/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### Browser Dashboard:
- Header with "AstraFlow" logo
- Sidebar on left with menu items:
  - Dashboard
  - Pipelines
  - Connections
  - Monitoring
  - Catalog
  - Governance
  - Cost Dashboard
  - Alerts
  - Docs
  - Settings
  - Marketplace
  - Audit Logs
- Main content area showing Dashboard
- User info in top-right: "Abhay Dubey" or similar

---

## 🎯 ALTERNATIVE: Manual Start (Two Terminals)

If `START_BOTH.bat` doesn't work, try manually:

### Terminal 1 - Backend:
```bash
cd "C:\Users\Abhay Dubey\Final_AstraFlow"
start_backend.bat
```

### Terminal 2 - Frontend:
```bash
cd "C:\Users\Abhay Dubey\Final_AstraFlow"
start_frontend.bat
```

### Then Open Browser:
http://localhost:8080

---

## 📝 AFTER STARTING

### Test These Pages (Click in Sidebar):
- [ ] Dashboard - Should show empty state or metrics
- [ ] Pipelines - Should show empty list
- [ ] Connections - Should show empty list
- [ ] Monitoring - Should show system info
- [ ] Settings - Should open settings page

All should work without errors!

---

## 🆘 IF IT DOESN'T WORK

**Share with me:**
1. Screenshot of backend CMD window
2. Screenshot of frontend CMD window
3. Screenshot of browser (if it opens)
4. Any error messages you see
5. Browser console errors (F12 → Console tab)

**I'll fix it immediately!** 🚀

---

## 🎉 EXPECTED RESULT

After running `START_BOTH.bat`:
- ✅ Backend starts in ~3 seconds (fast!)
- ✅ Frontend starts in ~5 seconds
- ✅ Browser opens to Dashboard
- ✅ You see "Abhay Dubey" as logged-in user
- ✅ All sidebar menus work
- ✅ No errors anywhere

**This means Phase 9 Verification can begin!**
