$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$stateFile = Join-Path $root ".tmp/local-services.json"

if (-not (Test-Path $stateFile)) {
    Write-Host "No local service state file found. Nothing to stop."
    return
}

$state = Get-Content -Raw $stateFile | ConvertFrom-Json
$pids = @($state.backendPid, $state.fastApiPid, $state.frontendPid) | Where-Object { $_ }

foreach ($pid in $pids) {
    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "Stopping PID $pid"
        Stop-Process -Id $pid -Force
    } else {
        Write-Host "PID $pid already stopped"
    }
}

Remove-Item $stateFile -Force
Write-Host "Local services stopped."
