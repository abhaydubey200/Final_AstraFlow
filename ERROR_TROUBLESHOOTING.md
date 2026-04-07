# Error Troubleshooting Guide

## Common Errors and Solutions

### Backend Startup Errors

#### 1. ModuleNotFoundError: No module named 'api.catalog_router'

**Error:**
```
ModuleNotFoundError: No module named 'api.catalog_router'
```

**Solution:**
```bash
# Verify file exists
ls backend/api/catalog_router.py

# If missing, file was created in wrong location
# Check if it's in: C:\Users\Abhay Dubey\Final_AstraFlow\backend\api\catalog_router.py
```

#### 2. ImportError: cannot import name 'router'

**Error:**
```
ImportError: cannot import name 'router' from 'api.catalog_router'
```

**Solution:**
Check that `catalog_router.py` has:
```python
router = APIRouter(prefix="/catalog", tags=["catalog"])
```

#### 3. AttributeError: 'NoneType' object has no attribute 'acquire'

**Error:**
```
AttributeError: 'NoneType' object has no attribute 'acquire'
```

**Cause:** Database pool is None but code tries to use it.

**Solution:** This should be fixed by our changes. If you still see this:
1. Check that endpoints have `if not pool: return []` checks
2. Verify the endpoint wraps db calls in try/except

### Frontend Console Errors

#### 1. Still Seeing 404 Errors

**Error in Console:**
```
GET http://localhost:8000/catalog/search 404 (Not Found)
```

**Solutions:**
1. **Backend not running:**
   ```bash
   cd backend
   python main.py
   ```

2. **Router not registered:**
   ```bash
   # Check main.py has these lines:
   from api.catalog_router import router as catalog_router
   app.include_router(catalog_router, tags=["catalog"])
   ```

3. **Clear browser cache:**
   - Press Ctrl+Shift+R to hard reload
   - Or clear cache and cookies

#### 2. Still Seeing 500 Errors

**Error in Console:**
```
GET http://localhost:8000/monitoring/metrics 500 (Internal Server Error)
```

**Solutions:**

1. **Check backend logs** - Look for Python traceback in terminal

2. **Missing database pool check:**
   ```python
   # Endpoints should have this pattern:
   pool = request.app.state.db_pool
   if not pool:
       return []  # or default data
   ```

3. **Service initialization error:**
   ```python
   # For service-dependent endpoints:
   try:
       if not pool:
           return []
       service = SomeService(pool)
       return await service.method()
   except Exception as e:
       print(f"Error: {e}")
       return []
   ```

#### 3. CORS Errors

**Error in Console:**
```
Access to fetch at 'http://localhost:8000/...' from origin 'http://localhost:5173' 
has been blocked by CORS policy
```

**Solution:**
Check `backend/main.py` has:
```python
ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:3000,http://localhost:8080"
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS.split(","),
    allow_credentials=True,
    ...
)
```

### Service Dependency Errors

#### 1. TypeError: GovernanceService() argument

**Error:**
```
TypeError: GovernanceService.__init__() missing 1 required positional argument: 'pool'
```

**Cause:** Service created without pool or with None pool.

**Solution:**
Endpoint should check pool first:
```python
async def endpoint(request: Request):
    pool = request.app.state.db_pool
    if not pool:
        return []  # Don't create service
    
    service = GovernanceService(pool)
    return await service.method()
```

#### 2. AsyncPG Pool Errors

**Error:**
```
asyncpg.exceptions.InterfaceError: pool is closed
```

**Solutions:**
1. Restart backend server
2. Check database connection in startup event
3. Verify database is running (if using external DB)

### Testing Errors

#### Running test_api_fixes.py

**Error:**
```
requests.exceptions.ConnectionError: ('Connection aborted.', RemoteDisconnected(...))
```

**Solution:**
1. Ensure backend is running: `python backend/main.py`
2. Wait a few seconds after starting before running tests
3. Check port 8000 is not blocked by firewall

**Error:**
```
ModuleNotFoundError: No module named 'requests'
```

**Solution:**
```bash
pip install requests
```

## Quick Diagnostic Commands

### Check Backend Status
```bash
# Test if backend is responding
curl http://localhost:8000/health

# Expected response:
# {"status":"online","version":"3.0.0-stable",...}
```

### Check Router Registration
```bash
# View registered routes
curl http://localhost:8000/docs

# Should show:
# - /catalog/search
# - /self-healing/status
# - /self-healing/logs
# - /monitoring/metrics
# - etc.
```

### Test Specific Endpoints
```bash
# Test catalog search
curl "http://localhost:8000/catalog/search?q=test"

# Test self-healing status
curl http://localhost:8000/self-healing/status

# Test monitoring metrics
curl http://localhost:8000/monitoring/metrics
```

## Verification Checklist

After fixing errors, verify:

- [ ] Backend starts without import errors
- [ ] `http://localhost:8000/health` returns 200 OK
- [ ] `http://localhost:8000/docs` shows all endpoints
- [ ] Frontend console has no 404 errors
- [ ] Frontend console has no 500 errors
- [ ] All pages load without crashes

## Still Having Issues?

### Get Detailed Backend Logs

Edit `backend/main.py` to add logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

Then restart and check the output for specific errors.

### Check File Structure

Verify these files exist:
```
backend/
├── api/
│   ├── catalog_router.py      ← NEW FILE
│   ├── self_healing_router.py ← Should exist
│   ├── monitoring_router.py   ← Modified
│   └── dependencies.py        ← Reverted
├── main.py                    ← Modified
└── test_api_fixes.py          ← NEW FILE
```

### Common Mistakes

1. **Wrong working directory** - Always `cd backend` before running
2. **Python version** - Requires Python 3.8+
3. **Missing dependencies** - Run `pip install -r requirements.txt`
4. **Port conflict** - Port 8000 already in use
5. **Cached imports** - Restart backend after file changes

## Need More Help?

Share the exact error message including:
1. Full error traceback from backend terminal
2. Browser console error (including URL that failed)
3. Which page/action triggered the error
