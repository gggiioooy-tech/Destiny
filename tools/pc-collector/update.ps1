$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$stateRoot = Split-Path $root
$log = Join-Path $root 'update-status.txt'
$allowed = @('start.ps1','desktop.ps1','update.ps1','release.json','server.mjs','watch.mjs','summarize.py','normalize.py','replay_skills.py','capture.py','capture_worker.py','battlefield.py','match_period.py','setup_game.py','prepare.ps1','gameCatalog.json','connect.html','connect.js','connect.css','uninstall.ps1')
$updateLock = New-Object System.Threading.Mutex($false, 'Local\15monthCollectorUpdater')
if (-not $updateLock.WaitOne(0)) { $updateLock.Dispose(); return }
$applied = @()
$backup = $null
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $manifestUrl = 'https://xn--15-7l8j.site/downloads/collector-release.json'
    $manifestResponse = Invoke-WebRequest -UseBasicParsing -Uri $manifestUrl -TimeoutSec 5 -MaximumRedirection 0
    $manifest = $manifestResponse.Content | ConvertFrom-Json
    if ($manifest.version -notmatch '^\d{4}\.\d{2}\.\d{2}\.\d+$' -or $manifest.sha256 -notmatch '^[a-f0-9]{64}$' -or $manifest.url -ne 'https://xn--15-7l8j.site/downloads/collector-update.zip') { throw '업데이트 정보를 확인할 수 없습니다.' }
    $local = $null
    try { $local = Get-Content -LiteralPath (Join-Path $root 'release.json') -Raw -Encoding UTF8 | ConvertFrom-Json } catch { }
    if ($local -and ([version]$local.version -ge [version]$manifest.version)) { [IO.File]::WriteAllText($log,'최신 버전입니다.'); return }
    # Never interrupt an active game capture. Apply on the next manual launch.
    $processes = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase) })
    if ($processes | Where-Object { ($_.Name -eq 'python.exe' -and $_.CommandLine -match 'capture(_worker)?\.py') -or ($_.Name -eq 'node.exe' -and $_.CommandLine -match 'watch\.mjs.*--red') }) { [IO.File]::WriteAllText($log,'수집 중이라 업데이트를 보류했습니다. 다음 실행 때 적용합니다.'); return }
    $stage = Join-Path ([IO.Path]::GetTempPath()) ('15month-update-'+[Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $stage | Out-Null
    $archive = Join-Path $stage 'update.zip'
    Invoke-WebRequest -UseBasicParsing -Uri $manifest.url -OutFile $archive -TimeoutSec 30 -MaximumRedirection 0
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.sha256) { throw '업데이트 파일 검증에 실패했습니다.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($archive)
    try {
        $seen = @{}
        foreach ($entry in $zip.Entries) {
            if ($entry.FullName -cnotin $allowed -or $seen.ContainsKey($entry.FullName) -or $entry.Length -gt 8388608) { throw '허용되지 않은 업데이트 파일입니다.' }
            $seen[$entry.FullName] = $true
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,(Join-Path $stage $entry.FullName))
        }
        foreach ($name in $allowed) { if (-not $seen.ContainsKey($name)) { throw '업데이트 파일이 누락됐습니다.' } }
    } finally { $zip.Dispose() }
    $release = Get-Content -LiteralPath (Join-Path $stage 'release.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($release.version -ne $manifest.version) { throw '업데이트 버전이 일치하지 않습니다.' }
    # Backup every target before replacing anything. Personal config and runtimes are excluded.
    $backup = Join-Path $root ('update-backup\'+[Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    foreach ($name in $allowed) { if (Test-Path -LiteralPath (Join-Path $root $name)) { Copy-Item -LiteralPath (Join-Path $root $name) -Destination (Join-Path $backup $name) } }
    $processes = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase) })
    if ($processes | Where-Object { ($_.Name -eq 'python.exe' -and $_.CommandLine -match 'capture(_worker)?\.py') -or ($_.Name -eq 'node.exe' -and $_.CommandLine -match 'watch\.mjs.*--red') }) { [IO.File]::WriteAllText($log,'수집 중이라 업데이트를 보류했습니다. 다음 실행 때 적용합니다.'); return }
    $processes | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match '(server|watch)\.mjs' } | ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }
    foreach ($name in $allowed) {
        $applied += $name
        Copy-Item -LiteralPath (Join-Path $stage $name) -Destination (Join-Path $root $name) -Force
    }
    [IO.File]::WriteAllText($log,('업데이트 완료 · '+$manifest.version))
    & (Join-Path $root 'start.ps1') -SkipUpdate
} catch {
    foreach ($name in $applied) {
        try { if (Test-Path -LiteralPath (Join-Path $backup $name)) { Copy-Item -LiteralPath (Join-Path $backup $name) -Destination (Join-Path $root $name) -Force } } catch { }
    }
    if ($applied.Count -gt 0) { try { & (Join-Path $root 'start.ps1') -SkipUpdate } catch { } }
    [IO.File]::WriteAllText($log,('업데이트 확인 실패 · 기존 버전으로 실행합니다. '+$_.Exception.Message))
} finally { $updateLock.ReleaseMutex(); $updateLock.Dispose() }
