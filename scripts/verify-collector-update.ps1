$ErrorActionPreference='Stop'
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('15month-updater-test-'+[Guid]::NewGuid().ToString('N'))
$app=Join-Path $fixture 'app'; $payload=Join-Path $fixture 'payload'
New-Item -ItemType Directory -Path $app,$payload -Force | Out-Null
Copy-Item tools/pc-collector/update.ps1 (Join-Path $app 'update.ps1')
$names=@('start.ps1','desktop.ps1','update.ps1','release.json','server.mjs','watch.mjs','summarize.py','normalize.py','replay_skills.py','capture.py','capture_worker.py','battlefield.py','match_period.py','setup_game.py','prepare.ps1','gameCatalog.json','connect.html','connect.js','connect.css','uninstall.ps1')
foreach($name in $names){[IO.File]::WriteAllText((Join-Path $payload $name),'fixture')}
[IO.File]::WriteAllText((Join-Path $payload 'start.ps1'),'param([switch]$SkipUpdate); [IO.File]::WriteAllText((Join-Path $PSScriptRoot "restarted.txt"),"yes")')
[IO.File]::WriteAllText((Join-Path $payload 'release.json'),'{"version":"2026.10.20.3"}')
$archive=Join-Path $fixture 'fixture.zip';Compress-Archive -Path (Join-Path $payload '*') -DestinationPath $archive
$global:collectorTest_fixtureArchive=$archive
$sha=(Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant()
$global:collectorTest_badHash=$true;$global:collectorTest_activeCapture=$false
function Invoke-WebRequest {param($Uri,$OutFile,$TimeoutSec,$MaximumRedirection,[switch]$UseBasicParsing)
 if($OutFile){Copy-Item $global:collectorTest_fixtureArchive $OutFile;return}
 $hash=if($global:collectorTest_badHash){'0'*64}else{$sha}
 return @{Content=(@{version='2026.10.20.3';url='https://xn--15-7l8j.site/downloads/collector-update.zip';sha256=$hash}|ConvertTo-Json)}
}
function Get-CimInstance {param($ClassName) if($global:collectorTest_activeCapture){[pscustomobject]@{ExecutablePath=($app+'\python\python.exe');Name='python.exe';CommandLine='python capture.py'}}}
function Stop-Process {throw 'Unexpected process stop in fixture'}
& (Join-Path $app 'update.ps1')
if(Test-Path (Join-Path $app 'release.json')){throw 'bad hash was applied'}
Write-Output 'PASS invalid archive hash preserves existing install'
$global:collectorTest_badHash=$false;$global:collectorTest_activeCapture=$true
& (Join-Path $app 'update.ps1')
if(Test-Path (Join-Path $app 'release.json')){throw 'updated during capture'}
Write-Output 'PASS active capture defers update'
$global:collectorTest_activeCapture=$false
$debugSource=Get-Content tools/pc-collector/update.ps1 -Raw -Encoding UTF8
[IO.File]::WriteAllText((Join-Path $app 'update.ps1'),$debugSource)
& (Join-Path $app 'update.ps1')
if(-not (Test-Path (Join-Path $app 'restarted.txt'))){throw ('update did not restart: '+(Get-Content (Join-Path $app 'update-status.txt')))}
if((Get-Content (Join-Path $app 'release.json') -Raw|ConvertFrom-Json).version -ne '2026.10.20.3'){throw 'wrong version'}
Write-Output 'PASS verified update applies and restarts'
# Restore real updater to test the current-version branch.
Copy-Item tools/pc-collector/update.ps1 (Join-Path $app 'update.ps1') -Force
& (Join-Path $app 'update.ps1')
if((Get-Content (Join-Path $app 'update-status.txt') -Raw) -notmatch '최신'){throw 'did not detect latest'}
Write-Output 'PASS current version is not reinstalled'
