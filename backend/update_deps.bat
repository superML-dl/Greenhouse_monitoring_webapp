@echo off
REM Update websockets to fix asyncio import error
conda run -n webapp pip install --upgrade "websockets>=13.0" -q
conda run -n webapp pip install -r requirements.txt -q
echo.
echo Dependencies updated successfully!
echo Now restart the backend server...
pause
