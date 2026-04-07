@echo off
title AstraFlow - Push to GitHub
color 0A

echo.
echo ═══════════════════════════════════════════════════════════════════
echo    AstraFlow - Push to GitHub
echo ═══════════════════════════════════════════════════════════════════
echo.

echo [Step 1/5] Checking Git status...
git status
echo.

echo [Step 2/5] Adding all files to git...
git add .
if errorlevel 1 (
    echo [ERROR] Failed to add files
    pause
    exit /b 1
)
echo [OK] Files added
echo.

echo [Step 3/5] Committing changes...
git commit -m "Project restructuring and comprehensive documentation

- Added complete project restructuring system
- Created comprehensive command documentation (RUN_APPLICATION_COMMANDS.md)
- Organized files into proper directories (/scripts, /tools, /logs, /docs)
- Added restructuring batch scripts
- Created detailed project structure documentation
- Added quick reference and cheatsheet files
- Improved README with professional formatting
- Added startup scripts and guides"

if errorlevel 1 (
    echo [INFO] No new changes to commit or already committed
)
echo.

echo [Step 4/5] Setting branch to main...
git branch -M main
echo [OK] Branch set to main
echo.

echo [Step 5/5] Pushing to GitHub...
echo Remote: https://github.com/dubeyabhay2003/AstraFlow.git
echo.

REM Check if remote exists
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo Adding remote origin...
    git remote add origin https://github.com/dubeyabhay2003/AstraFlow.git
) else (
    echo Remote already configured
)

echo Pushing to GitHub...
git push -u origin main

if errorlevel 1 (
    echo.
    echo [WARNING] Push failed. Trying force push...
    echo This might be needed if remote history differs.
    echo.
    set /p force="Force push? This will overwrite remote. (Y/N): "
    if /i "%force%"=="Y" (
        git push -u origin main --force
        if errorlevel 1 (
            echo [ERROR] Force push also failed
            echo.
            echo Please check:
            echo   1. Your internet connection
            echo   2. GitHub authentication (you may need a personal access token)
            echo   3. Repository exists: https://github.com/dubeyabhay2003/AstraFlow
            echo.
            pause
            exit /b 1
        )
    ) else (
        echo Push cancelled
        pause
        exit /b 1
    )
)

echo.
echo ═══════════════════════════════════════════════════════════════════
echo    SUCCESS! Code pushed to GitHub
echo ═══════════════════════════════════════════════════════════════════
echo.
echo Your code is now on GitHub:
echo https://github.com/dubeyabhay2003/AstraFlow
echo.
echo What was pushed:
echo   ✓ Complete project restructuring documentation
echo   ✓ Command reference guides
echo   ✓ Restructuring scripts
echo   ✓ Updated project structure
echo   ✓ All new documentation files
echo.
pause
