param(
    [string]$ProjectName = "studysync",
    [switch]$RemoveNetwork,
    [switch]$RemoveData
)

$ErrorActionPreference = "Stop"

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

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Required command 'docker' was not found in PATH."
}

$null = Invoke-Docker -Description "checking Docker daemon status" -DockerArgs @("info") -Quiet

$containers = @(
    "$ProjectName-frontend",
    "$ProjectName-backend",
    "$ProjectName-fastapi",
    "$ProjectName-mongo"
)

foreach ($name in $containers) {
    $existing = Invoke-Docker -Description "listing containers" -DockerArgs @("ps", "-a", "--format", "{{.Names}}") | Where-Object { $_ -eq $name }
    if ($existing) {
        Write-Host "Stopping and removing $name"
        Invoke-Docker -Description "removing container $name" -DockerArgs @("rm", "-f", $name) | Out-Null
    } else {
        Write-Host "Container not found (already removed): $name"
    }
}

if ($RemoveNetwork) {
    $network = "$ProjectName-network"
    $networkExists = Invoke-Docker -Description "listing networks" -DockerArgs @("network", "ls", "--format", "{{.Name}}") | Where-Object { $_ -eq $network }
    if ($networkExists) {
        Write-Host "Removing network $network"
        Invoke-Docker -Description "removing network $network" -DockerArgs @("network", "rm", $network) | Out-Null
    }
}

if ($RemoveData) {
    $volume = "$ProjectName-mongo-data"
    $volumeExists = Invoke-Docker -Description "listing volumes" -DockerArgs @("volume", "ls", "--format", "{{.Name}}") | Where-Object { $_ -eq $volume }
    if ($volumeExists) {
        Write-Host "Removing volume $volume"
        Invoke-Docker -Description "removing volume $volume" -DockerArgs @("volume", "rm", $volume) | Out-Null
    }
}

Write-Host "Done."
