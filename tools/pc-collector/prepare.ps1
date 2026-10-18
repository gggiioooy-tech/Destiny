$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') {'arm64'} else {'amd64'}
$hashes = @{amd64='a93abe456ab01bd96d7a085b3cdb6566b3063f4241360d114142fbdb07f0a310';arm64='155be84ccb57c6331cf0e39001c78a1dfac3be62f403f3ff5f2e29b80dda7ebe'}
function Download-Verified($url,$destination,$sha) {
    if (-not (Test-Path -LiteralPath $destination) -or (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sha) {
        Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $destination
    }
    if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sha) {throw '설치 파일 검증에 실패했습니다.'}
}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$pythonZip = Join-Path $root 'python-runtime.zip'
Download-Verified "https://www.python.org/ftp/python/3.14.8/python-3.14.8-embed-$arch.zip" $pythonZip $hashes[$arch]
Expand-Archive -LiteralPath $pythonZip -DestinationPath (Join-Path $root 'python') -Force
# Include our scripts and pure-Python protobuf; never depend on a machine-wide Python.
[IO.File]::WriteAllText((Join-Path $root 'python/python314._pth'), "python314.zip`n.`n..`n../vendor`n")
$wheel = Join-Path $root 'protobuf.zip'
Download-Verified 'https://files.pythonhosted.org/packages/e4/04/d52c7016b04b6c5108f26691f9d33ec82a9b65d041f1a9c771137693d618/protobuf-7.36.2-py3-none-any.whl' $wheel 'bdb3a345d48db958e6ce1f18e508beb0cc981d64f24088427549c866cd039f1e'
Expand-Archive -LiteralPath $wheel -DestinationPath (Join-Path $root 'vendor') -Force
Write-Output '게임 수집 실행 환경 준비 완료.'
if (-not (Test-Path -LiteralPath "$env:SystemRoot/System32/Npcap/wpcap.dll")) {
    Write-Output 'Npcap 공식 설치 프로그램을 준비합니다. Windows 권한 요청을 허용하고 설치를 완료해 주세요.'
    $npcap = Join-Path $root 'npcap-installer.exe'
    Download-Verified 'https://npcap.com/dist/npcap-1.89.exe' $npcap '8aed85e900d783d1308506e919587d3e540451947af8a82f2d04f819e44305cc'
    if ((Get-AuthenticodeSignature -LiteralPath $npcap).Status -ne 'Valid') { throw 'Npcap 서명을 확인할 수 없습니다.' }
    Start-Process -FilePath $npcap -Verb RunAs -Wait
    if (-not (Test-Path -LiteralPath "$env:SystemRoot/System32/Npcap/wpcap.dll")) { throw 'Npcap 설치가 완료되지 않았습니다. 이거누르면설치됨.cmd를 다시 실행해 주세요.' }
}
