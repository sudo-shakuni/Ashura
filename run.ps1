# ASHURA v2.0 Windows PowerShell Launcher
# Can be run via: powershell -ExecutionPolicy Bypass -File .\run.ps1

Set-Location $PSScriptRoot
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "            ASHURA v2.0 Windows Launcher           " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not found on your system PATH." -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/ and try again."
    Read-Host "Press Enter to exit..."
    exit 1
}

if (-not (Test-Path "node_modules")) {
    Write-Host "[1/2] Installing dependencies..." -ForegroundColor Yellow
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] npm install failed." -ForegroundColor Red
        Read-Host "Press Enter to exit..."
        exit $LASTEXITCODE
    }
} else {
    Write-Host "[1/2] Dependencies found." -ForegroundColor Green
}

Write-Host "`n[2/2] Starting development server..." -ForegroundColor Cyan
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 3
    Start-Process "http://localhost:3000"
} | Out-Null

& npm.cmd run dev
