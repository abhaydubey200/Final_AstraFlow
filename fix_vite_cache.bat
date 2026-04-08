@echo off
echo ===============================================
echo CLEAR VITE CACHE - FIX RUNTIME ERROR
echo ===============================================
echo.
echo Error: Module does not provide export 'useCreateConnection'
echo Cause: Vite dev server cache issue
echo.
echo This will clear the cache and restart.
echo.
pause

echo.
echo [1/2] Clearing Vite cache...
rmdir /S /Q "node_modules\.vite" 2>nul
echo    ✓ Vite cache cleared

echo.
echo [2/2] Starting dev server...
echo.
echo ===============================================
echo Frontend will auto-reload in browser
echo Press Ctrl+C to stop
echo ===============================================
echo.
npm run dev
