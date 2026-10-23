@echo off
setlocal
cd /d "%~dp0"

rem Start the no-cache dev server in its own window.
rem serve.py prints a clear message and exits harmlessly if the port is
rem already serving, so double-clicking this repeatedly is safe.
start "Schematic Canvas Server" cmd /k python serve.py

rem Give the server a moment to bind, then open the app.
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8642/index.html"
endlocal
