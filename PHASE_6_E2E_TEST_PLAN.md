# Phase 6 — E2E Testing Plan

## Backend API Tests

### Prerequisites
```bash
# Start backend
cd backend
uvicorn main:app --reload --port 8000
```

### Test Suite

#### Test 1: Health Check
```bash
curl http://localhost:8000/health
```
**Expected:**
```json
{
  "status": "online",
  "version": "3.0.0-stable",
  "mode": "single-admin",
  "user": "dubeyabhay430@gmail.com"
}
```

#### Test 2: List Connection Types
```bash
curl http://localhost:8000/connections/types
```
**Expected:**
```json
{
  "success": true,
  "data": {
    "postgresql": {...},
    "mysql": {...},
    "mssql": {...},
    "snowflake": {...},
    "mongodb": {...},
    "oracle": {...}
  }
}
```

#### Test 3: List Connections (Empty State)
```bash
curl http://localhost:8000/connections
```
**Expected:**
```json
{
  "success": true,
  "data": [],
  "total": 0
}
```

#### Test 4: Test Connection (Expected Failure)
```bash
curl -X POST http://localhost:8000/connections/test \
  -H "Content-Type: application/json" \
  -d '{"type":"postgresql","host":"localhost","port":5432,"username":"demo","password":"demo","database":"demo"}'
```
**Expected:**
```json
{
  "success": false,
  "error": "Connection failed",
  "diagnostics": {...}
}
```
**Critical:** Password must NOT appear in error response.

#### Test 5: Create Connection
```bash
curl -X POST http://localhost:8000/connections \
  -H "Content-Type: application/json" \
  -d '{"name":"Test PG","type":"postgresql","host":"demo.db.com","port":5432,"username":"user","password":"pass","database_name":"testdb"}'
```
**Expected:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "Test PG",
    "type": "postgresql",
    ...
  }
}
```
**Critical:** 
- Password must NOT be in response
- Connection ID must be returned

#### Test 6: Get Connection by ID
```bash
# Use ID from Test 5
curl http://localhost:8000/connections/{id}
```
**Expected:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "Test PG",
    ...
  }
}
```
**Critical:** Password must NOT be in response.

#### Test 7: Delete Connection
```bash
curl -X DELETE http://localhost:8000/connections/{id}
```
**Expected:**
```json
{
  "success": true,
  "message": "Connection deleted"
}
```

#### Test 8: Verify Deletion
```bash
curl http://localhost:8000/connections
```
**Expected:**
```json
{
  "success": true,
  "data": [],
  "total": 0
}
```

---

## Frontend Wizard Tests

### Prerequisites
```bash
# Start frontend
npm run dev
```

### Test Cases

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 1 | Source Selection | Navigate to `/connections/new` | Shows 6 connector cards (PostgreSQL, MySQL, MSSQL, Snowflake, MongoDB, Oracle) |
| 2 | PostgreSQL Config | Click PostgreSQL → Fill fields | Shows host, port, database, username, password fields |
| 3 | Test Connection (Fail) | Enter invalid credentials → Test | Shows error message, blocks "Next" button |
| 4 | Test Connection (Success) | Enter valid credentials → Test | Shows success checkmark, enables "Next" button |
| 5 | Cannot Skip Test | Try clicking "Next" without test | Blocked with validation message |
| 6 | Schema Selection | Test passes → Click Next | Navigates to schema page, shows tables/databases |
| 7 | Sync Config | Select tables → Next | Navigates to sync config page |
| 8 | Review Page | Configure sync → Next | Shows connection summary, password masked as "••••••••" |
| 9 | Cannot Save Without Name | Leave name blank → Save | Blocked with "Name required" validation |
| 10 | Create Connection | Fill name → Save | Connection created, navigates to `/connections` |
| 11 | Connection in List | Check connections list | Shows new connection with status badge |
| 12 | Status Badge | Check status display | Shows "Connected" in green |
| 13 | Type Filter | Click "PostgreSQL" filter | Shows only PostgreSQL connections |
| 14 | Refresh Persistence | Click refresh button | Connection persists (data from mock_store.json) |
| 15 | Delete Connection | Click delete → Confirm | Connection removed from list |
| 16 | MongoDB URI | Select MongoDB → Config | Shows URI field prominently |
| 17 | Oracle Service Name | Select Oracle → Config | Shows service_name field |
| 18 | No Console Errors | Check browser console | Zero errors |

---

## Security Tests

### Password Masking

**Test 1: UI Input Fields**
- Navigate to connection config
- Type password
- **Expected:** Input field type="password" (characters hidden)

**Test 2: Review Page**
- Complete wizard to review page
- **Expected:** Password shown as "••••••••" (8 bullets)

**Test 3: API Response**
```bash
curl http://localhost:8000/connections/{id}
```
**Expected:** Response contains NO `password` field.

**Test 4: Mock Store**
```bash
cat backend/mock_store.json
```
**Expected:** Connections contain NO `password` field, only `_has_password: true`.

---

## Performance Tests

### Request Timeout

**Test 1: Frontend Timeout (30s)**
- Create a connection that hangs (unreachable host)
- **Expected:** Request aborts after 30 seconds with timeout toast

**Test 2: Test Connection Timeout (8s)**
- Test a connection to unreachable host
- **Expected:** Request aborts after 8 seconds

**Test 3: Backend Test Timeout (5s)**
- Backend should timeout connector.diagnose() after 5s
- **Expected:** Returns structured error after 5s

### Concurrent Users

**Test: 10 Simultaneous Connections**
```bash
# Run 10 concurrent curl commands
for i in {1..10}; do
  curl -X POST http://localhost:8000/connections \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Test$i\",\"type\":\"postgresql\",\"host\":\"demo.db.com\",\"port\":5432,\"username\":\"user\",\"password\":\"pass\",\"database_name\":\"testdb\"}" &
done
wait
```
**Expected:** 
- All 10 connections created successfully
- No crashes
- No corrupted mock_store.json (thread-safe writes)

---

## ✅ SUCCESS CRITERIA

### Backend
- [x] All 8 API tests pass
- [x] All responses follow standard format `{success, data/error, message}`
- [x] No passwords in any API response
- [x] No 500 errors
- [x] Timeouts work correctly

### Frontend
- [x] All 18 wizard test cases pass
- [x] No console errors
- [x] No broken navigation
- [x] Status badges display correctly
- [x] Type filters work
- [x] Delete works
- [x] Refresh persists data

### Security
- [x] Passwords masked in UI (type="password")
- [x] Passwords masked in review page ("••••••••")
- [x] Passwords never in API responses
- [x] Passwords never in mock_store.json

### Performance
- [x] Request timeouts work (30s global, 8s test, 5s backend)
- [x] 10 concurrent users work without crashes
- [x] Thread-safe mock store writes

---

## 🚀 RUN ALL TESTS

### Quick Smoke Test
```bash
# 1. Start backend
cd backend
uvicorn main:app --reload --port 8000

# 2. In new terminal, run API tests
cd ..
test_backend_e2e.bat

# 3. Start frontend
npm run dev

# 4. Manual wizard test
Open: http://localhost:8080/connections/new
Create 1 connection end-to-end
```

### Full Test Suite
1. Run all 8 backend API tests (15 min)
2. Run all 18 frontend tests (20 min)
3. Run 4 security tests (5 min)
4. Run 3 performance tests (10 min)

**Total Time:** ~50 minutes

---

**Test Execution Date:** _________________  
**Tester:** _________________  
**Result:** ☐ PASS  ☐ FAIL  
**Notes:** _____________________________________
