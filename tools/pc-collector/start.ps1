$ErrorActionPreference = 'Stop'
$collectorRoot = $PSScriptRoot
$stateRoot = Join-Path $env:LOCALAPPDATA '15month-collector'
if (-not (Test-Path -LiteralPath (Join-Path $stateRoot 'config.json'))) {
    throw 'PC 수집기 초기 설정이 필요합니다.'
}
$nodePath = (Get-Command node -ErrorAction Stop).Source
$serverPath = Join-Path $collectorRoot 'server.mjs'
$watchPath = Join-Path $collectorRoot 'watch.mjs'
$runningNodes = @(Get-CimInstance Win32_Process -Filter "name='node.exe'")
$serverRunning = $runningNodes | Where-Object { $_.CommandLine -like '*tools/pc-collector/server.mjs*' -or $_.CommandLine -like "*$serverPath*" }
$watchRunning = $runningNodes | Where-Object { $_.CommandLine -like '*tools/pc-collector/watch.mjs*' -or $_.CommandLine -like "*$watchPath*" }
if (-not $serverRunning) {
    Start-Process -FilePath $nodePath -ArgumentList @('"' + $serverPath + '"') -WorkingDirectory $collectorRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $stateRoot 'server.log') -RedirectStandardError (Join-Path $stateRoot 'server-error.log')
}
if (-not $watchRunning) {
    Start-Process -FilePath $nodePath -ArgumentList @('"' + $watchPath + '"') -WorkingDirectory $collectorRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $stateRoot 'watch.log') -RedirectStandardError (Join-Path $stateRoot 'watch-error.log')
}
Write-Output 'PC 연결 프로그램을 실행했습니다. 15월사이트 길드전에서 PC 수집기 연결을 누르세요.'
