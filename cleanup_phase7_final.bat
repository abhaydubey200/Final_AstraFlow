@echo off
REM AstraFlow Phase 7 Final Cleanup (Enhanced)
REM Removes dead files, unused code, and debug artifacts

echo ==========================================
echo ASTRAFLOW FINAL CLEANUP - PHASE 7
echo ==========================================
echo.
echo This script will remove:
echo - File connectors (CSV, JSON, Parquet)
echo - Unused cost_router.py
echo - Debug scripts (20+ files)
echo - Verification scripts (15+ files)
echo - Temp files (.tmp)
echo - Debug artifacts (logs, error files)
echo - Root-level audit scripts
echo - Output/lint artifacts
echo.
echo Press any key to continue or Ctrl+C to cancel...
pause >nul
echo.

REM File Connectors (Not in scope)
echo [1/8] Removing file connectors (CSV, JSON, Parquet)...
del /F /Q backend\core\csv_connector.py 2>nul
del /F /Q backend\core\json_connector.py 2>nul
del /F /Q backend\core\parquet_connector.py 2>nul
del /F /Q backend\core\parquet_utils.py 2>nul
echo    ✓ File connectors removed

REM Cost Router (Not registered, not needed)
echo [2/8] Removing unused cost router...
del /F /Q backend\api\cost_router.py 2>nul
echo    ✓ Cost router removed

REM Debug Scripts
echo [3/8] Removing debug scripts...
del /F /Q backend\debug_imports.py 2>nul
del /F /Q backend\debug_startup.py 2>nul
del /F /Q backend\manual_verify.py 2>nul
del /F /Q backend\restore_simulation.py 2>nul
del /F /Q backend\simulate_runtime.py 2>nul
del /F /Q backend\perf_analyzer.py 2>nul
echo    ✓ Debug scripts removed

REM Verification Scripts
echo [4/8] Removing verification scripts...
del /F /Q backend\verify_dag_compilation.py 2>nul
del /F /Q backend\verify_data_flow.py 2>nul
del /F /Q backend\verify_fix.py 2>nul
del /F /Q backend\verify_healing.py 2>nul
del /F /Q backend\verify_monitoring.py 2>nul
del /F /Q backend\verify_repairs.py 2>nul
echo    ✓ Verification scripts removed

REM Temp Files
echo [5/8] Removing .tmp files...
del /F /Q backend\*.tmp 2>nul
del /F /Q *.tmp 2>nul
echo    ✓ Temp files removed

REM Debug Artifacts
echo [6/8] Removing debug artifacts...
del /F /Q backend\discovery_error.txt 2>nul
del /F /Q backend\startup_log.txt 2>nul
del /F /Q backend\fail_fast_log.txt 2>nul
echo    ✓ Debug artifacts removed

REM Root-level Check Scripts (Audit Scripts - Not Production)
echo [7/8] Removing root-level audit scripts...
del /F /Q check_*.py 2>nul
del /F /Q test_*.py 2>nul
del /F /Q apply_migrations.py 2>nul
del /F /Q audit_test.py 2>nul
del /F /Q debug_snowflake.py 2>nul
del /F /Q deep_audit.py 2>nul
del /F /Q fix_*.py 2>nul
del /F /Q verify_connection_fixes.py 2>nul
echo    ✓ Audit scripts removed

REM Root-level Output Files (Lint/Test Artifacts)
echo [8/8] Removing root-level output artifacts...
del /F /Q lint_output*.txt 2>nul
del /F /Q lint_results*.txt 2>nul
del /F /Q lint_report.txt 2>nul
del /F /Q pytest_*.txt 2>nul
del /F /Q test_conn_*.txt 2>nul
del /F /Q test_out*.txt 2>nul
del /F /Q qa_out*.txt 2>nul
del /F /Q final_qa_out*.txt 2>nul
del /F /Q perf_*.txt 2>nul
del /F /Q security_report*.txt 2>nul
del /F /Q out.txt 2>nul
del /F /Q verify_output.txt 2>nul
del /F /Q api_health_check.txt 2>nul
del /F /Q application_start_steps.txt 2>nul
del /F /Q frontend_start_log.txt 2>nul
echo    ✓ Output artifacts removed

echo.
echo ==========================================
echo CLEANUP COMPLETE ✓
echo ==========================================
echo.
echo Files removed: ~60+ files
echo.
echo FINAL VERIFICATION:
echo - backend/core should have only 6 connectors + base_connector.py
echo - backend/api should NOT have cost_router.py
echo - Root should have NO .tmp or debug .py files
echo.
echo Next step: Run Phase 6 E2E tests
echo   1. Start backend: cd backend ^&^& uvicorn main:app --reload --port 8000
echo   2. Run tests: test_backend_e2e.bat
echo.
pause
