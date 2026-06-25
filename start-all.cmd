@echo off
title Sticky Trap AI - Launcher
color 0A
echo.
echo  ============================================
echo   Sticky Trap AI - Starting All Services
echo  ============================================
echo.

set "ROOT=%~dp0"

:: Kill any existing processes on ports 8000 and 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING 2^>nul') do (
    echo  [cleanup] Killing existing process on port 8000 (PID %%a)
    taskkill /PID %%a /F >nul 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    echo  [cleanup] Killing existing process on port 3000 (PID %%a)
    taskkill /PID %%a /F >nul 2>nul
)

echo  [1/2] Starting Backend API (port 8000)...
start "Backend API" /min cmd /k "title Backend API - port 8000 && call "%ROOT%start-backend.cmd""

echo  [2/2] Starting Frontend App (port 3000)...
start "Frontend App" /min cmd /k "title Frontend App - port 3000 && call "%ROOT%start-frontend.cmd""

echo.
echo  ============================================
echo   Both services launched!
echo.
echo   Frontend : http://localhost:3000
echo   Backend  : http://localhost:8000
echo   API Docs : http://localhost:8000/docs
echo  ============================================
echo.

:: Wait until frontend is actually listening on port 3000 (max ~60s)
set /a WAIT_COUNT=0
:wait_frontend
set /a WAIT_COUNT+=1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    set "PORT_READY=1"
)

if defined PORT_READY (
    echo  [ok] Frontend is ready on port 3000. Opening browser...
    start "" http://localhost:3000
    goto :eof
)

if %WAIT_COUNT% GEQ 30 (
    echo  [warn] Frontend not ready yet. Open manually: http://localhost:3000
    goto :eof
)

echo  [wait] Waiting for frontend to start... (%WAIT_COUNT%/30)
timeout /t 2 /nobreak >nul
goto :wait_frontend
