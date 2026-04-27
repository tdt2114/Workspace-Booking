$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "mobile-common.ps1")

$state = Read-MobileState

if (-not $state) {
  Write-Host "No mobile-dev session state found." -ForegroundColor Yellow
  exit 0
}

foreach ($process in $state.processes) {
  if (Test-MobileProcessAlive -Id $process.pid) {
    try {
      Stop-MobileProcessTree -Id $process.pid
      Write-Host "Stopped $($process.name) (PID $($process.pid))." -ForegroundColor Green
    } catch {
      Write-Host "Failed to stop $($process.name) (PID $($process.pid)): $($_.Exception.Message)" -ForegroundColor Yellow
    }
  } else {
    Write-Host "$($process.name) (PID $($process.pid)) was already stopped." -ForegroundColor Yellow
  }
}

Remove-MobileState
Write-Host "Mobile-dev session cleared." -ForegroundColor Green
