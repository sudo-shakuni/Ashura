@echo off
setlocal
title ASHURA v2.0 - Windows Launcher
cd /d "%~dp0"

echo ===================================================
echo             ASHURA v2.0 Windows Launcher
echo ===================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found on your PATH!
    echo Please install Node.js from https://nodejs.org/ and try again.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [1/2] Installing dependencies with npm.cmd...
    call npm.cmd install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b %ERRORLEVEL%
    )
) else (
    echo [1/2] Dependencies already installed.
)

echo.
echo [2/2] Starting Next.js development server...
echo.
echo Launching your browser at http://localhost:3000 in 3 seconds...
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

call npm.cmd run dev
pause
