@echo off
setlocal

set "ROOT=%~dp0"
set "ENV_PY=C:\Users\Admin\miniconda3\envs\webapp\python.exe"

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
	echo Stopping existing process on port 8000: %%a
	taskkill /PID %%a /F >nul 2>nul
)

pushd "%ROOT%backend"

if exist "%ENV_PY%" (
	echo Starting backend with direct conda env python on port 8000...
	"%ENV_PY%" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
	if %ERRORLEVEL%==0 goto :eof
	echo Direct env python failed. Trying other fallbacks...
)

where conda >nul 2>nul
if %ERRORLEVEL%==0 (
	echo Starting backend with conda env 'webapp' on port 8000...
	conda run -n webapp python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
	if %ERRORLEVEL%==0 goto :eof
	echo Conda run failed. Trying local fallbacks...
)

if exist "%ROOT%backend\.venv\Scripts\python.exe" (
	echo Starting backend with backend\.venv on port 8000...
	"%ROOT%backend\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
	goto :eof
)

echo Conda not found. Falling back to system python on port 8000...
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
if %ERRORLEVEL%==0 goto :eof

echo Python command failed. Trying py launcher...
py -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
if %ERRORLEVEL%==0 goto :eof

echo.
echo Failed to start backend. Please ensure one of the following is available:
echo 1) conda env 'webapp' with dependencies installed
echo 2) backend\.venv with dependencies installed
echo 3) system python/py with dependencies installed
exit /b 1
