@echo off
REM C.Biz POS Print Service — Windows Startup
REM Copy this file to the print-service folder on your POS machine.
REM Run it at startup (Windows key + R → shell:startup → add shortcut to this file).
REM
REM The service listens on http://127.0.0.1:9101 and receives print jobs
REM from the POS web app running in Firefox.

cd /d "%~dp0"

REM Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed. Download from https://nodejs.org
    pause
    exit /b 1
)

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo.
echo ============================================
echo   C.Biz POS — starting app + print service
echo ============================================
echo.

npm start
pause
