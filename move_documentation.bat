@echo off
echo Moving documentation files to docs folder...

REM Move all MD files to docs except the main ones
move /Y "BEGINNERS_GUIDE.md" "docs\" 2>nul
move /Y "CONNECTION_GUIDE.md" "docs\" 2>nul
move /Y "EMERGENCY_FIX.md" "docs\" 2>nul
move /Y "HOW_TO_SEND_ERRORS.md" "docs\" 2>nul
move /Y "HOW_TO_START.md" "docs\" 2>nul
move /Y "QUICKSTART.md" "docs\" 2>nul
move /Y "SETUP_GUIDE.md" "docs\" 2>nul
move /Y "START_NOW.md" "docs\" 2>nul
move /Y "STABILIZATION_PROGRESS.md" "docs\" 2>nul

echo Documentation organized successfully!
echo.
echo Documentation files are now in /docs folder:
dir /B docs\*.md
echo.
pause
