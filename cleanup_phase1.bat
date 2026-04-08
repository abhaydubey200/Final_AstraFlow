@echo off
echo ========================================
echo PHASE 1: CLEANUP & STRUCTURE
echo ========================================
echo.

echo [1/5] Deleting file connectors...
del /F /Q "backend\core\csv_connector.py" 2>nul
del /F /Q "backend\core\json_connector.py" 2>nul
del /F /Q "backend\core\parquet_connector.py" 2>nul
del /F /Q "backend\core\parquet_utils.py" 2>nul
echo ✓ File connectors deleted

echo.
echo [2/5] Deleting cost_router...
del /F /Q "backend\api\cost_router.py" 2>nul
echo ✓ cost_router deleted

echo.
echo [3/5] Deleting debug scripts...
del /F /Q "backend\debug_imports.py" 2>nul
del /F /Q "backend\debug_startup.py" 2>nul
del /F /Q "backend\manual_verify.py" 2>nul
del /F /Q "backend\restore_simulation.py" 2>nul
del /F /Q "backend\simulate_runtime.py" 2>nul
del /F /Q "backend\perf_analyzer.py" 2>nul
echo ✓ Debug scripts deleted

echo.
echo [4/5] Deleting verify scripts...
del /F /Q "backend\verify_dag_compilation.py" 2>nul
del /F /Q "backend\verify_data_flow.py" 2>nul
del /F /Q "backend\verify_fix.py" 2>nul
del /F /Q "backend\verify_healing.py" 2>nul
del /F /Q "backend\verify_monitoring.py" 2>nul
del /F /Q "backend\verify_repairs.py" 2>nul
echo ✓ Verify scripts deleted

echo.
echo [5/5] Deleting temp files and debug artifacts...
del /F /Q "backend\*.tmp" 2>nul
del /F /Q "backend\discovery_error.txt" 2>nul
del /F /Q "backend\startup_log.txt" 2>nul
del /F /Q "backend\fail_fast_log.txt" 2>nul
echo ✓ Temp files deleted

echo.
echo ========================================
echo ✅ PHASE 1 CLEANUP COMPLETE
echo ========================================
pause
