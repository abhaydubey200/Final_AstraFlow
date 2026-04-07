@echo off
echo Creating new directory structure...

REM Create main directories
mkdir "scripts\testing" 2>nul
mkdir "scripts\database" 2>nul
mkdir "scripts\utilities" 2>nul
mkdir "logs\tests" 2>nul
mkdir "logs\performance" 2>nul
mkdir "logs\security" 2>nul
mkdir "logs\linting" 2>nul
mkdir "tools\linters" 2>nul
mkdir "tools\scanners" 2>nul

echo.
echo Moving testing scripts...
move /Y "audit_test.py" "scripts\testing\" 2>nul
move /Y "deep_audit.py" "scripts\testing\" 2>nul
move /Y "test_ipv6.py" "scripts\testing\" 2>nul
move /Y "test_mssql_instantiation.py" "scripts\testing\" 2>nul
move /Y "test_snowflake_fallback.py" "scripts\testing\" 2>nul
move /Y "test_supabase_connection.py" "scripts\testing\" 2>nul
move /Y "analyze_load_test.py" "scripts\testing\" 2>nul

echo Moving database scripts...
move /Y "check_db.py" "scripts\database\" 2>nul
move /Y "check_keys.py" "scripts\database\" 2>nul
move /Y "check_mssql_data.py" "scripts\database\" 2>nul
move /Y "check_mssql_registry.py" "scripts\database\" 2>nul
move /Y "check_pooling.py" "scripts\database\" 2>nul
move /Y "check_registry_schemas.py" "scripts\database\" 2>nul
move /Y "check_snowflake_version.py" "scripts\database\" 2>nul
move /Y "check_supabase_health.py" "scripts\database\" 2>nul
move /Y "debug_snowflake.py" "scripts\database\" 2>nul
move /Y "fix_mock_db.py" "scripts\database\" 2>nul
move /Y "setup_database.py" "scripts\database\" 2>nul
move /Y "apply_migrations.py" "scripts\database\" 2>nul

echo Moving utility scripts...
move /Y "fix_use_effects.cjs" "scripts\utilities\" 2>nul
move /Y "update_readme.py" "scripts\utilities\" 2>nul

echo Moving linters and scanners...
move /Y "custom_ts_linter.cjs" "tools\linters\" 2>nul
move /Y "custom_ts_linter_deep.cjs" "tools\linters\" 2>nul
move /Y "security_scanner.cjs" "tools\scanners\" 2>nul

echo Moving test output files...
move /Y "test_conn_err.txt" "logs\tests\" 2>nul
move /Y "test_conn_err_v2.txt" "logs\tests\" 2>nul
move /Y "test_conn_out.txt" "logs\tests\" 2>nul
move /Y "test_out.txt" "logs\tests\" 2>nul
move /Y "test_out_raw.txt" "logs\tests\" 2>nul
move /Y "test_out_raw2.txt" "logs\tests\" 2>nul
move /Y "test_out_raw3.txt" "logs\tests\" 2>nul
move /Y "test_out_raw4.txt" "logs\tests\" 2>nul
move /Y "test_out_raw5.txt" "logs\tests\" 2>nul
move /Y "test_perf_out.txt" "logs\tests\" 2>nul
move /Y "pytest_out.txt" "logs\tests\" 2>nul
move /Y "pytest_output.txt" "logs\tests\" 2>nul
move /Y "qa_out.txt" "logs\tests\" 2>nul
move /Y "final_qa_out.txt" "logs\tests\" 2>nul
move /Y "final_qa_out_v2.txt" "logs\tests\" 2>nul
move /Y "final_qa_out_v3.txt" "logs\tests\" 2>nul
move /Y "verify_output.txt" "logs\tests\" 2>nul
move /Y "out.txt" "logs\tests\" 2>nul
move /Y "api_health_check.txt" "logs\tests\" 2>nul

echo Moving performance logs...
move /Y "perf_output.txt" "logs\performance\" 2>nul
move /Y "perf_output_after.txt" "logs\performance\" 2>nul
move /Y "perf_results.txt" "logs\performance\" 2>nul

echo Moving security logs...
move /Y "security_report.txt" "logs\security\" 2>nul
move /Y "security_report_final.txt" "logs\security\" 2>nul
move /Y "final_security_report.txt" "logs\security\" 2>nul

echo Moving linting logs...
move /Y "lint_output.txt" "logs\linting\" 2>nul
move /Y "lint_output_2.txt" "logs\linting\" 2>nul
move /Y "lint_output_3.txt" "logs\linting\" 2>nul
move /Y "lint_output_final.txt" "logs\linting\" 2>nul
move /Y "lint_report.txt" "logs\linting\" 2>nul
move /Y "lint_results.txt" "logs\linting\" 2>nul
move /Y "lint_results_utf8.txt" "logs\linting\" 2>nul
move /Y "frontend_start_log.txt" "logs\linting\" 2>nul

echo.
echo Reorganization complete!
echo.
echo New structure:
echo - /scripts (testing, database, utilities)
echo - /logs (tests, performance, security, linting)
echo - /tools (linters, scanners)
echo - /docs (documentation - already exists)
echo - /backend (backend code)
echo - /src (frontend code)
echo - /public (public assets)
echo.
pause
