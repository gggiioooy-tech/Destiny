$ErrorActionPreference = 'Stop'
# Remove only this user's URL handler; keep all collected records and settings.
$scheme = 'HKCU:\Software\Classes\month15-collector'
if (Test-Path -LiteralPath $scheme) { Remove-Item -LiteralPath $scheme -Recurse }
Write-Output '사이트에서 PC 프로그램을 여는 연결을 해제했습니다. 수집 자료는 보존됩니다.'
