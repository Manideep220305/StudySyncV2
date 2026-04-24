param(
    [string]$ProjectName = "studysync",
    [string]$BackendEnvPath = "backend/.env",
    [string]$FastApiEnvPath = "fastapi-rag/.env"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot

function Assert-CommandExists {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH."
    }
}

function Invoke-Docker {
    param(
        [string]$Description,
        [string[]]$DockerArgs,
        [switch]$Quiet
    )

    if ($Quiet) {
        $output = & docker @DockerArgs 2>$null
    } else {
        $output = & docker @DockerArgs
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed while ${Description}: docker $($DockerArgs -join ' ')"
    }

    return $output
}

function Assert-DockerDaemonRunning {
    $null = Invoke-Docker -Description "checking Docker daemon status" -DockerArgs @("info") -Quiet
}

function Assert-FileExists {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Required file not found: $Path"
    }
}

function Remove-ContainerIfExists {
    param([string]$Name)

    $existingId = ((& docker ps -aq --filter "name=^${Name}$") | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed while checking existing container: $Name"
    }

    if ($existingId) {
        Write-Host "Removing existing container: $Name"
        Invoke-Docker -Description "removing existing container $Name" -DockerArgs @("rm", "-f", $Name) | Out-Null
    }
}

function Wait-HttpReady {
    param(
        [string]$Name,
        [string]$Url,
        [int]$MaxAttempts = 40,
        [int]$DelaySeconds = 2
    )

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                Write-Host "$Name ready at $Url"
                return
            }
        } catch {
            # Service is still booting
        }

        Start-Sleep -Seconds $DelaySeconds
    }

    throw "$Name did not become ready at $Url in time."
}

try {
    Assert-CommandExists -Name "docker"
    Assert-DockerDaemonRunning
    Assert-FileExists -Path $BackendEnvPath
    Assert-FileExists -Path $FastApiEnvPath

    if (-not (Select-String -Path $FastApiEnvPath -Pattern "^GROQ_API_KEY\s*=\s*(?!\s*$)(?!replace_with)" -Quiet)) {
        throw "Set GROQ_API_KEY in $FastApiEnvPath before running containers."
    }

    $network = "$ProjectName-network"
    $mongoVolume = "$ProjectName-mongo-data"

    $mongoContainer = "$ProjectName-mongo"
    $fastapiContainer = "$ProjectName-fastapi"
    $backendContainer = "$ProjectName-backend"
    $frontendContainer = "$ProjectName-frontend"

    $fastapiImage = "$ProjectName-fastapi:latest"
    $backendImage = "$ProjectName-backend:latest"
    $frontendImage = "$ProjectName-frontend:latest"

    $networkExists = Invoke-Docker -Description "listing docker networks" -DockerArgs @("network", "ls", "--format", "{{.Name}}") | Where-Object { $_ -eq $network }
    if (-not $networkExists) {
        Write-Host "Creating network: $network"
        Invoke-Docker -Description "creating docker network $network" -DockerArgs @("network", "create", $network) | Out-Null
    }

    $volumeExists = Invoke-Docker -Description "listing docker volumes" -DockerArgs @("volume", "ls", "--format", "{{.Name}}") | Where-Object { $_ -eq $mongoVolume }
    if (-not $volumeExists) {
        Write-Host "Creating volume: $mongoVolume"
        Invoke-Docker -Description "creating docker volume $mongoVolume" -DockerArgs @("volume", "create", $mongoVolume) | Out-Null
    }

    Remove-ContainerIfExists -Name $frontendContainer
    Remove-ContainerIfExists -Name $backendContainer
    Remove-ContainerIfExists -Name $fastapiContainer
    Remove-ContainerIfExists -Name $mongoContainer

    Write-Host "Starting MongoDB container..."
    Invoke-Docker -Description "starting MongoDB container" -DockerArgs @("run", "-d", "--name", $mongoContainer, "--network", $network, "-p", "27017:27017", "-v", "${mongoVolume}:/data/db", "--restart", "unless-stopped", "mongo:7") | Out-Null

    Write-Host "Building FastAPI image..."
    Invoke-Docker -Description "building FastAPI image" -DockerArgs @("build", "-t", $fastapiImage, "./fastapi-rag") | Out-Null

    Write-Host "Starting FastAPI container..."
    Invoke-Docker -Description "starting FastAPI container" -DockerArgs @("run", "-d", "--name", $fastapiContainer, "--network", $network, "-p", "8000:8000", "--env-file", $FastApiEnvPath, "-e", "NODE_BACKEND_URL=http://$($backendContainer):5000", "--restart", "unless-stopped", $fastapiImage) | Out-Null

    Write-Host "Building backend image..."
    Invoke-Docker -Description "building backend image" -DockerArgs @("build", "-t", $backendImage, "./backend") | Out-Null

    Write-Host "Starting backend container..."
    Invoke-Docker -Description "starting backend container" -DockerArgs @("run", "-d", "--name", $backendContainer, "--network", $network, "-p", "5000:5000", "--env-file", $BackendEnvPath, "-e", "NODE_ENV=production", "-e", "PORT=5000", "-e", "MONGO_URI=mongodb://$($mongoContainer):27017/studysync", "-e", "FASTAPI_URL=http://$($fastapiContainer):8000", "-e", "CLIENT_URL=http://localhost:8080", "-e", "CORS_ORIGINS=http://localhost:8080", "--restart", "unless-stopped", $backendImage) | Out-Null

    Write-Host "Building frontend image..."
    Invoke-Docker -Description "building frontend image" -DockerArgs @("build", "-t", $frontendImage, "--build-arg", "VITE_API_URL=http://localhost:5000", "--build-arg", "VITE_SOCKET_URL=http://localhost:5000", "./frontend") | Out-Null

    Write-Host "Starting frontend container..."
    Invoke-Docker -Description "starting frontend container" -DockerArgs @("run", "-d", "--name", $frontendContainer, "--network", $network, "-p", "8080:80", "--restart", "unless-stopped", $frontendImage) | Out-Null

    Wait-HttpReady -Name "FastAPI" -Url "http://localhost:8000/health"
    Wait-HttpReady -Name "Backend" -Url "http://localhost:5000/health"
    Wait-HttpReady -Name "Frontend" -Url "http://localhost:8080/health"

    Write-Host ""
    Write-Host "Stack is ready:"
    Write-Host "Frontend: http://localhost:8080"
    Write-Host "Backend : http://localhost:5000/health"
    Write-Host "FastAPI : http://localhost:8000/health"
    Write-Host ""
    Invoke-Docker -Description "listing started containers" -DockerArgs @("ps", "--filter", "name=$ProjectName", "--format", "table {{.Names}}\t{{.Status}}\t{{.Ports}}")
}
finally {
    Pop-Location
}
