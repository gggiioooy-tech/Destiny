param([switch]$SkipUpdate)
$ErrorActionPreference = 'Stop'
$collectorRoot = $PSScriptRoot
$stateRoot = Join-Path $env:LOCALAPPDATA '15month-collector'
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
$nodePath = Join-Path $collectorRoot 'node.exe'
if (-not (Test-Path -LiteralPath $nodePath)) { $nodePath = (Get-Command node -ErrorAction Stop).Source }
$launchLock = New-Object System.Threading.Mutex($false, 'Local\15monthCollectorLauncher')
if (-not $launchLock.WaitOne(5000)) { exit }
try {
$serverPath = Join-Path $collectorRoot 'server.mjs'
$watchPath = Join-Path $collectorRoot 'watch.mjs'
$runningNodes = @(Get-CimInstance Win32_Process -Filter "name='node.exe'")
$serverRunning = $runningNodes | Where-Object { $_.CommandLine -like '*tools/pc-collector/server.mjs*' -or $_.CommandLine -like '*15month-collector\app\server.mjs*' -or $_.CommandLine -like "*$serverPath*" }
$watchRunning = $runningNodes | Where-Object { $_.CommandLine -like '*tools/pc-collector/watch.mjs*' -or $_.CommandLine -like '*15month-collector\app\watch.mjs*' -or $_.CommandLine -like "*$watchPath*" }
if (-not $serverRunning) {
    Start-Process -FilePath $nodePath -ArgumentList @('"' + $serverPath + '"') -WorkingDirectory $collectorRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $stateRoot 'server.log') -RedirectStandardError (Join-Path $stateRoot 'server-error.log')
}
if (-not $watchRunning -and (Test-Path -LiteralPath (Join-Path $stateRoot 'config.json'))) {
    Start-Process -FilePath $nodePath -ArgumentList @('"' + $watchPath + '"') -WorkingDirectory $collectorRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $stateRoot 'watch.log') -RedirectStandardError (Join-Path $stateRoot 'watch-error.log')
}
if (-not $SkipUpdate -and (Test-Path -LiteralPath (Join-Path $collectorRoot 'update.ps1'))) {
    $powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    Start-Process -FilePath $powershell -ArgumentList @('-NoProfile','-WindowStyle','Hidden','-ExecutionPolicy','Bypass','-File', ('"'+(Join-Path $collectorRoot 'update.ps1')+'"')) -WorkingDirectory $collectorRoot -WindowStyle Hidden
}
Write-Output 'PC 연결 프로그램을 실행했습니다. 15월사이트 길드전에서 PC 수집기 연결을 누르세요.'
} finally { $launchLock.ReleaseMutex(); $launchLock.Dispose() }
