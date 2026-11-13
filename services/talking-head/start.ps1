# Starts the free local talking-head renderer used by the Video Generator.
# Keep this window open while generating videos.
param([string]$SadTalkerHome = (Join-Path $env:USERPROFILE "creatoros-sadtalker"))
$ErrorActionPreference = "Stop"

$envFile = Join-Path $PSScriptRoot "..\..\.env.local"
$line = Get-Content $envFile | Where-Object { $_ -match '^TALKING_HEAD_TOKEN=' } | Select-Object -First 1
if (-not $line) { throw "TALKING_HEAD_TOKEN is missing from .env.local" }
$env:TALKING_HEAD_TOKEN = ($line -replace '^TALKING_HEAD_TOKEN=', '').Trim().Trim('"')
$env:SADTALKER_DIR = Join-Path $SadTalkerHome "SadTalker"
$env:TALKING_HEAD_WORK_DIR = Join-Path $SadTalkerHome "jobs"

$python = Join-Path $SadTalkerHome ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) { throw "SadTalker is not installed at $SadTalkerHome. See services/talking-head/README.md." }
& $python (Join-Path $PSScriptRoot "server.py")
