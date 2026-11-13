@echo off
rem Starts CreatorOS on this computer: the video render service and the web app.
rem Double-click this file. Keep both windows open while you use the app.
title CreatorOS launcher

rem Conda and other Python settings break the render service's own Python, so clear them.
set PYTHONHOME=
set PYTHONPATH=
set __PYVENV_LAUNCHER__=
set CONDA_PREFIX=
set CONDA_DEFAULT_ENV=

set "WEB=%~dp0."
set "RENDER=%~dp0services\talking-head"

if not exist "%WEB%\package.json" (
  echo Could not find the web app at "%WEB%".
  pause
  exit /b 1
)

netstat -ano | findstr /r /c:":7861 .*LISTENING" >nul
if errorlevel 1 (
  if exist "%RENDER%\start.ps1" (
    start "CreatorOS video renderer - keep open" powershell -NoProfile -ExecutionPolicy Bypass -File "%RENDER%\start.ps1"
  ) else (
    echo Video renderer not found at "%RENDER%". The app will start, but videos will not render.
  )
) else (
  echo Video renderer is already running.
)

netstat -ano | findstr /r /c:":3000 .*LISTENING" >nul
if errorlevel 1 (
  start "CreatorOS web app - keep open" cmd /k "cd /d "%WEB%" && npm run dev"
) else (
  echo Web app is already running.
)

echo.
echo Opening http://localhost:3000 in your browser...
echo The video renderer needs about 2 minutes before it can make videos.
timeout /t 12 /nobreak >nul
start "" http://localhost:3000
