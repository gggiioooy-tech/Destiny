$ErrorActionPreference = 'Stop'
$installRoot = Join-Path $env:LOCALAPPDATA '15month-collector\app'
New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
$hashes = @{x64='b3094d0b49f9ad602262a9921551737bb97637c05dd357a06ae98188d7290aa3';arm64='6694c2553f41d6b7cd6e396536e9ad5a9f4e1b898d59e4e0ec5de127096eb6db'}
$runtime = Join-Path $installRoot 'node.exe'
if (-not (Test-Path -LiteralPath $runtime) -or (Get-FileHash -LiteralPath $runtime -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hashes[$arch]) {
    Write-Output '공식 Node.js 실행 파일을 준비합니다...'
    $download = Join-Path $installRoot 'node.download'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/dist/v24.16.0/win-$arch/node.exe" -OutFile $download
    if ((Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hashes[$arch]) { throw '실행 파일 검증에 실패했습니다. 설치를 중단합니다.' }
    Move-Item -LiteralPath $download -Destination $runtime -Force
}
$files = @('start.ps1','server.mjs','watch.mjs','summarize.py','normalize.py','replay_skills.py','connect.html','connect.js','connect.css','uninstall.ps1')
foreach ($file in $files) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $installRoot $file) -Force }
$scheme = 'HKCU:\Software\Classes\month15-collector'
New-Item -Path $scheme -Force | Out-Null
Set-Item -Path $scheme -Value 'URL:15month PC Collector'
New-ItemProperty -Path $scheme -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
$commandKey = New-Item -Path "$scheme\shell\open\command" -Force
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
# Deliberately ignore all URL arguments. A website can only launch this fixed app.
$command = '"' + $powershell + '" -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $installRoot 'start.ps1') + '"'
Set-Item -Path $commandKey.PSPath -Value $command
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) '15월 PC 연결.lnk'))
$shortcut.TargetPath = $powershell
$shortcut.Arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $installRoot 'start.ps1') + '"'
$shortcut.WindowStyle = 7
$shortcut.Save()
Write-Output '설치 완료. 15월사이트에서 PC 수집기 연결을 누르세요.'
& (Join-Path $installRoot 'start.ps1')
