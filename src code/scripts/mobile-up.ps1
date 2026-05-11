$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "mobile-common.ps1")

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$existingState = Read-MobileState

if ($existingState) {
  $aliveProcesses = @($existingState.processes | Where-Object { Test-MobileProcessAlive -Id $_.pid })

  if ($aliveProcesses.Count -gt 0) {
    throw "A mobile-dev session is already running. Use 'npm run mobile:status' or 'npm run mobile:down' first."
  }

  Remove-MobileState
}

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  throw "cloudflared was not found in PATH. Install it first or reopen the terminal."
}

$tunnelMaxAttempts = 5
$tunnelRetryDelaySeconds = 6

$env:NEXT_PUBLIC_API_BASE_URL = "/api"
$env:API_PROXY_TARGET = "http://127.0.0.1:3001"

Write-Host "Building web-final for mobile-dev mode..." -ForegroundColor Cyan
& npm run build:final

$apiProcess = Start-MobileBackgroundProcess `
  -Name "api" `
  -Command "`$env:PORT='3001'; npm run dev:api" `
  -Workdir $root

$webProcess = Start-MobileBackgroundProcess `
  -Name "web-final" `
  -Command "`$env:NEXT_PUBLIC_API_BASE_URL='/api'; `$env:API_PROXY_TARGET='http://127.0.0.1:3001'; npm run start:final" `
  -Workdir $root

$state = [pscustomobject]@{
  startedAt = (Get-Date).ToString("o")
  processes = @($apiProcess, $webProcess)
}

Write-MobileState -State $state

try {
  Write-Host "Waiting for API on http://127.0.0.1:3001/health ..." -ForegroundColor Cyan
  Wait-ForHttpReady -Url "http://127.0.0.1:3001/health" -TimeoutSeconds 90 | Out-Null

  Write-Host "Waiting for web-final on http://127.0.0.1:3002/login ..." -ForegroundColor Cyan
  Wait-ForHttpReady -Url "http://127.0.0.1:3002/login" -TimeoutSeconds 90 | Out-Null

  Write-Host "" 
  Write-Host "Desktop local:" -ForegroundColor Green
  Write-Host "  http://localhost:3002/login"
  Write-Host "Mobile/HTTPS tunnel will be printed below by cloudflared." -ForegroundColor Green
  Write-Host "Leave this terminal open while testing. Run 'npm run mobile:down' in another terminal to stop the session." -ForegroundColor Yellow
  Write-Host ""

  for ($attempt = 1; $attempt -le $tunnelMaxAttempts; $attempt++) {
    Write-Host "Starting Cloudflare quick tunnel (attempt $attempt/$tunnelMaxAttempts)..." -ForegroundColor Cyan
    & cloudflared tunnel --url http://localhost:3002
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
      break
    }

    if ($attempt -lt $tunnelMaxAttempts) {
      Write-Host ""
      Write-Host "Cloudflare quick tunnel failed with exit code $exitCode. Retrying in $tunnelRetryDelaySeconds seconds..." -ForegroundColor Yellow
      Write-Host "The local API and web preview are still running; this usually means trycloudflare.com returned a temporary 500/1101." -ForegroundColor Yellow
      Start-Sleep -Seconds $tunnelRetryDelaySeconds
      Write-Host ""
      continue
    }

    throw "Cloudflare quick tunnel failed after $tunnelMaxAttempts attempts. Local preview is healthy at http://localhost:3002/login, but mobile HTTPS tunnel could not be created."
  }
} catch {
  Write-Host $_ -ForegroundColor Red
  throw
} finally {
  $currentState = Read-MobileState

  if ($currentState) {
    Write-Host ""
    Write-Host "Tunnel closed. Cleaning up preview processes..." -ForegroundColor Yellow
    Stop-MobileTrackedProcesses -State $currentState
    Remove-MobileState
    Write-Host "Preview session cleaned up." -ForegroundColor Green
  }
}
