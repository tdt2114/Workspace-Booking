$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "mobile-common.ps1")

$state = Read-MobileState

if (-not $state) {
  Write-Host "No preview session is running." -ForegroundColor Green
  exit 0
}

Stop-MobileTrackedProcesses -State $state

Remove-MobileState
Write-Host "Preview session stopped. You can close any old tunnel browser tabs." -ForegroundColor Green
