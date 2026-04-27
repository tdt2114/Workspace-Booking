$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "mobile-common.ps1")

$state = Read-MobileState

if (-not $state) {
  Write-Host "No mobile-dev session state found." -ForegroundColor Yellow
  exit 0
}

Write-Host "Mobile-dev session started at $($state.startedAt)" -ForegroundColor Cyan

foreach ($process in $state.processes) {
  $status = if (Test-MobileProcessAlive -Id $process.pid) { "running" } else { "stopped" }

  Write-Host "- $($process.name): $status (PID $($process.pid))"
  Write-Host "  stdout: $($process.stdout)"
  Write-Host "  stderr: $($process.stderr)"
}
