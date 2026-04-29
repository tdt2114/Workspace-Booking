$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "mobile-common.ps1")

$state = Read-MobileState

if (-not $state) {
  Write-Host "No preview session is running." -ForegroundColor Green
  exit 0
}

foreach ($process in $state.processes) {
  if (Test-MobileProcessAlive -Id $process.pid) {
    try {
      Stop-MobileProcessTree -Id $process.pid
      Write-Host "Stopped $($process.name)." -ForegroundColor Green
    } catch {
      Write-Host "$($process.name) was already closed." -ForegroundColor Yellow
    }
  } else {
    Write-Host "$($process.name) was already closed." -ForegroundColor Yellow
  }
}

Remove-MobileState
Write-Host "Preview session stopped. You can close any old tunnel browser tabs." -ForegroundColor Green
