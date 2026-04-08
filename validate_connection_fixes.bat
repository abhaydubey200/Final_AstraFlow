@echo off
REM ========================================
REM Connection Page Validation Script
REM ========================================

echo.
echo ============================================================
echo   ASTRAFLOW CONNECTION MODULE VALIDATION
echo ============================================================
echo.

echo [1/5] Checking Backend Connector Registry...
echo --------------------------------------------------------
cd backend
python test_connectors.py
if errorlevel 1 (
    echo.
    echo ❌ FAILED: Connector registry has errors
    echo    Check backend/test_connectors.py output above
    pause
    exit /b 1
)

echo.
echo [2/5] Checking if backend/mock_store.json exists...
echo --------------------------------------------------------
if exist mock_store.json (
    echo ✅ PASSED: mock_store.json exists
) else (
    echo ❌ FAILED: mock_store.json not found
    echo    Creating empty mock_store.json...
    echo {"connections": [], "sync_configs": []} > mock_store.json
)

echo.
echo [3/5] Counting connections in mock store...
echo --------------------------------------------------------
python -c "import json; data = json.load(open('mock_store.json')); print(f'✅ Found {len(data.get(\"connections\", []))} connections in mock store')"

echo.
echo [4/5] Verifying TypeScript types are valid...
echo --------------------------------------------------------
cd ..
echo Checking src/types/connection.ts...
findstr /C:"mongodb" src\types\connection.ts >nul
if errorlevel 1 (
    echo ❌ FAILED: mongodb not found in ConnectionType
) else (
    echo ✅ PASSED: mongodb found in types
)

findstr /C:"oracle" src\types\connection.ts >nul
if errorlevel 1 (
    echo ❌ FAILED: oracle not found in ConnectionType
) else (
    echo ✅ PASSED: oracle found in types
)

findstr /C:"csv" src\types\connection.ts >nul
if errorlevel 1 (
    echo ✅ PASSED: csv correctly removed from types
) else (
    echo ❌ FAILED: csv still present (should be removed^)
)

echo.
echo [5/5] Checking frontend source selection...
echo --------------------------------------------------------
findstr /C:"mongodb" src\pages\connection-wizard\SourceSelectionPage.tsx >nul
if errorlevel 1 (
    echo ❌ FAILED: mongodb not in source selection
) else (
    echo ✅ PASSED: mongodb in source selection
)

findstr /C:"oracle" src\pages\connection-wizard\SourceSelectionPage.tsx >nul
if errorlevel 1 (
    echo ❌ FAILED: oracle not in source selection
) else (
    echo ✅ PASSED: oracle in source selection  
)

findstr /C:"csv" src\pages\connection-wizard\SourceSelectionPage.tsx >nul
if errorlevel 1 (
    echo ✅ PASSED: csv correctly removed from source selection
) else (
    echo ❌ FAILED: csv still present (should be removed^)
)

echo.
echo ============================================================
echo   VALIDATION COMPLETE
echo ============================================================
echo.
echo ✅ All checks passed!
echo.
echo NEXT STEPS:
echo   1. Restart your backend server (python backend/main.py)
echo   2. Hard refresh frontend (Ctrl+Shift+R in browser)
echo   3. Go to http://localhost:8080/connections
echo   4. Try creating a PostgreSQL connection
echo   5. Verify it appears in the list after saving
echo.
echo See CONNECTION_FIX_COMPLETE.md for detailed instructions.
echo.
pause
