param(
    [string]$BackendDir = "backend",
    [string]$FrontendDir = "frontend",
    [string]$FastApiDir = "fastapi-rag"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root

function Assert-PathExists {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        throw "Required path not found: $Path"
    }
}

function Assert-CommandExists {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found in PATH: $Name"
    }
}

function Test-PortInUse {
    param([int]$Port)
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return [bool]$conn
}

function Require-FreePort {
    param([int]$Port, [string]$Service)
    if (Test-PortInUse -Port $Port) {
        throw "Port $Port is already in use. Stop the process using it before starting $Service."
    }
}

try {
    Assert-PathExists -Path $BackendDir
    Assert-PathExists -Path $FrontendDir
    Assert-PathExists -Path $FastApiDir

    Assert-PathExists -Path "$BackendDir/.env"
    Assert-PathExists -Path "$FastApiDir/.env"

    Assert-CommandExists -Name "node"
    Assert-CommandExists -Name "npm"
    Assert-CommandExists -Name "python"

    Require-FreePort -Port 5000 -Service "backend"
    Require-FreePort -Port 5173 -Service "frontend"
    Require-FreePort -Port 8000 -Service "fastapi-rag"

    $fastApiHasKey = Select-String -Path "$FastApiDir/.env" -Pattern '^GROQ_API_KEY\s*=\s*(?!\s*$)(?!replace_with)' -Quiet
    if (-not $fastApiHasKey) {
        throw "Set GROQ_API_KEY in $FastApiDir/.env before starting fastapi-rag."
    }

    Write-Host "Starting backend on 5000..."
    $backendProc = Start-Process -FilePath powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$BackendDir'; npm start"
    ) -PassThru

    Write-Host "Starting fastapi-rag on 8000..."
    $fastApiProc = Start-Process -FilePath powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$FastApiDir'; python -m uvicorn main:app --host 0.0.0.0 --port 8000"
    ) -PassThru

    Write-Host "Starting frontend on 5173..."
    $frontendProc = Start-Process -FilePath powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$FrontendDir'; npm run dev -- --host 0.0.0.0 --port 5173"
    ) -PassThru

    $stateDir = Join-Path $root ".tmp"
    if (-not (Test-Path $stateDir)) {
        New-Item -Path $stateDir -ItemType Directory | Out-Null
    }

    $stateFile = Join-Path $stateDir "local-services.json"
    $state = [PSCustomObject]@{
        createdAt = (Get-Date).ToString("o")
        backendPid = $backendProc.Id
        fastApiPid = $fastApiProc.Id
        frontendPid = $frontendProc.Id
    }
    $state | ConvertTo-Json | Set-Content -Path $stateFile -Encoding UTF8

    Write-Host ""
    Write-Host "Local services started."
    Write-Host "Frontend: http://localhost:5173"
    Write-Host "Backend : http://localhost:5000/health"
    Write-Host "FastAPI : http://localhost:8000/health"
    Write-Host ""
    Write-Host "To stop all, run: ./scripts/stop-local.ps1"
}
finally {
    Pop-Location
}
