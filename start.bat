@echo off
REM Celebiz POS — One-click startup (Windows)
REM Starts both the web app and the ESC/POS print service.

cd /d "%~dp0"

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed. Download from https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo.
echo ============================================
echo   Celebiz POS — starting...
echo   App:  http://localhost:5173
echo   Print: http://127.0.0.1:9101
echo ============================================
echo.

call npm start
pause
