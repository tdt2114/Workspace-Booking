$ErrorActionPreference = "Stop"

function Get-MobileStateDirectory {
  $root = Resolve-Path (Join-Path $PSScriptRoot "..")
  $stateDir = Join-Path $root ".mobile-dev"

  if (-not (Test-Path $stateDir)) {
    New-Item -ItemType Directory -Path $stateDir | Out-Null
  }

  return $stateDir
}

function Get-MobileStateFile {
  $stateDir = Get-MobileStateDirectory
  return Join-Path $stateDir "state.json"
}

function Get-MobileLogPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $stateDir = Get-MobileStateDirectory
  return Join-Path $stateDir $Name
}

function Read-MobileState {
  $stateFile = Get-MobileStateFile

  if (-not (Test-Path $stateFile)) {
    return $null
  }

  return Get-Content -Raw -Path $stateFile | ConvertFrom-Json
}

function Write-MobileState {
  param(
    [Parameter(Mandatory = $true)]
    [psobject]$State
  )

  $stateFile = Get-MobileStateFile
  $State | ConvertTo-Json -Depth 5 | Set-Content -Path $stateFile
}

function Remove-MobileState {
  $stateFile = Get-MobileStateFile

  if (Test-Path $stateFile) {
    Remove-Item -LiteralPath $stateFile
  }
}

function Test-MobileProcessAlive {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Id
  )

  try {
    $null = Get-Process -Id $Id -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

function Stop-MobileProcessTree {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Id
  )

  $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $Id" -ErrorAction SilentlyContinue)

  foreach ($child in $children) {
    try {
      Stop-MobileProcessTree -Id $child.ProcessId
    } catch {
      # Child processes can exit naturally while shutdown is running.
    }
  }

  if (Test-MobileProcessAlive -Id $Id) {
    try {
      Stop-Process -Id $Id -Force -ErrorAction Stop
    } catch [Microsoft.PowerShell.Commands.ProcessCommandException] {
      # Treat already-exited processes as successfully cleaned up.
    } catch [System.ArgumentException] {
      # Some Windows process lookups race with process exit.
    }
  }
}

function Stop-MobileTrackedProcesses {
  param(
    [Parameter(Mandatory = $true)]
    [psobject]$State
  )

  foreach ($process in $State.processes) {
    if (Test-MobileProcessAlive -Id $process.pid) {
      Write-Host "Stopping $($process.name)..." -ForegroundColor Cyan

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
}

function Wait-ForHttpReady {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url,
    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 500
      continue
    }

    Start-Sleep -Milliseconds 500
  }

  throw "Timed out waiting for $Url"
}

function Start-MobileBackgroundProcess {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$Command,
    [Parameter(Mandatory = $true)]
    [string]$Workdir
  )

  $stdout = Get-MobileLogPath "$Name.stdout.log"
  $stderr = Get-MobileLogPath "$Name.stderr.log"

  if (Test-Path $stdout) {
    Remove-Item -LiteralPath $stdout
  }

  if (Test-Path $stderr) {
    Remove-Item -LiteralPath $stderr
  }

  $process = Start-Process `
    -FilePath "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" `
    -ArgumentList @("-NoLogo", "-NoProfile", "-Command", $Command) `
    -WorkingDirectory $Workdir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -PassThru

  return [pscustomobject]@{
    name = $Name
    pid = $process.Id
    stdout = $stdout
    stderr = $stderr
    command = $Command
  }
}
