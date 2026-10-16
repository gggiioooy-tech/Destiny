$ErrorActionPreference = 'Stop'
try {
    Write-Host '15월 PC 연결 프로그램을 켜고 있습니다...'
    & (Join-Path $PSScriptRoot 'start.ps1')
    $ready = $false
    for ($attempt = 0; $attempt -lt 15; $attempt++) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:15150/connect' -TimeoutSec 2
            if ($response.StatusCode -eq 200 -and $response.Content.Contains('/connect.js')) { $ready = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw '연결 프로그램이 응답하지 않습니다. 다시 실행하거나 최신 설치 파일로 재설치해 주세요.' }
    Write-Host '실행 완료. 연결 상태 창을 엽니다.'
    Start-Process 'http://127.0.0.1:15150/connect'
} catch {
    Write-Host ('실행 실패: ' + $_.Exception.Message) -ForegroundColor Red
    Read-Host '이 오류를 알려 주세요. Enter를 누르면 닫힙니다'
    exit 1
}
