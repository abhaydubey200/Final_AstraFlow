@echo off
title AstraFlow - Project Restructuring
color 0A

echo.
echo ====================================================================
echo    AstraFlow Project Restructuring
echo ====================================================================
echo.
echo This script will organize your project into a clean structure:
echo.
echo   /backend          - Backend Python code
echo   /src              - Frontend React code  
echo   /docs             - All documentation
echo   /scripts          - Testing and utility scripts
echo   /tools            - Linters and scanners
echo   /logs             - All log files
echo   /public           - Public assets
echo   /deploy           - Deployment configs
echo   /monitoring       - Monitoring setup
echo   /supabase         - Supabase configs
echo.
echo Root will only contain essential config files and startup scripts
echo.
echo ====================================================================
echo.
pause

REM Step 1: Create directory structure
echo.
echo [1/3] Creating directory structure...
call :create_dirs
echo Done!

REM Step 2: Move scripts and tools
echo.
echo [2/3] Organizing scripts, tools, and logs...
call reorganize_project.bat
timeout /t 2 >nul

REM Step 3: Move documentation
echo.
echo [3/3] Organizing documentation...
call move_documentation.bat
timeout /t 2 >nul

echo.
echo ====================================================================
echo    Restructuring Complete!
echo ====================================================================
echo.
echo Your project is now professionally organized!
echo.
echo Next steps:
echo   1. Review PROJECT_STRUCTURE.md for full directory layout
echo   2. Check that everything is in the right place
echo   3. Run: start_astraflow.bat to test your application
echo.
echo ====================================================================
echo.

REM Show the new structure
echo Current directory structure:
echo.
tree /F /A | findstr /V ".git node_modules __pycache__ dist .venv tmp" | more

echo.
echo Press any key to exit...
pause >nul
goto :eof

:create_dirs
REM Create all directories silently
mkdir "docs" 2>nul
mkdir "scripts\testing" 2>nul
mkdir "scripts\database" 2>nul
mkdir "scripts\utilities" 2>nul
mkdir "logs\tests" 2>nul
mkdir "logs\performance" 2>nul
mkdir "logs\security" 2>nul
mkdir "logs\linting" 2>nul
mkdir "tools\linters" 2>nul
mkdir "tools\scanners" 2>nul
goto :eof
