param(
    [switch]$SkipSql,
    [switch]$SkipAzurite,
    [switch]$SkipApi,
    [switch]$SkipFrontend,
    [switch]$ApplyMigrations
)

$ErrorActionPreference = "Stop"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptPath "..")
$backendRoot = Join-Path $repoRoot "backend"
$apiRoot = Join-Path $backendRoot "src\Alife.Api"
$frontendRoot = Join-Path $repoRoot "cloudflare\alife-app"
$runtimeRoot = Join-Path $repoRoot ".local-dev"
$logRoot = Join-Path $runtimeRoot "logs"
$azuriteRoot = Join-Path $runtimeRoot "azurite"

New-Item -ItemType Directory -Force -Path $logRoot, $azuriteRoot | Out-Null

function Test-PortListening {
    param([int]$Port)

    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1

    return $null -ne $connection
}

function Wait-Port {
    param(
        [int]$Port,
        [string]$Name,
        [int]$TimeoutSeconds = 90
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortListening -Port $Port) {
            Write-Host "$Name is listening on port $Port."
            return
        }

        Start-Sleep -Seconds 2
    }

    throw "$Name did not start listening on port $Port within $TimeoutSeconds seconds."
}

function Wait-DockerHealthy {
    param(
        [string]$ContainerName,
        [int]$TimeoutSeconds = 120
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $status = docker inspect --format "{{.State.Health.Status}}" $ContainerName 2>$null
        if ($LASTEXITCODE -eq 0 -and $status -eq "healthy") {
            Write-Host "$ContainerName is healthy."
            return
        }

        Start-Sleep -Seconds 3
    }

    throw "$ContainerName did not become healthy within $TimeoutSeconds seconds."
}

function Start-LoggedProcess {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$WorkingDirectory,
        [string]$OutLog,
        [string]$ErrLog
    )

    Write-Host "Starting $Name..."
    $process = Start-Process `
        -FilePath $FilePath `
        -ArgumentList $ArgumentList `
        -WorkingDirectory $WorkingDirectory `
        -RedirectStandardOutput $OutLog `
        -RedirectStandardError $ErrLog `
        -WindowStyle Hidden `
        -PassThru

    Write-Host "$Name started. PID $($process.Id). Logs:"
    Write-Host "  $OutLog"
    Write-Host "  $ErrLog"
}

if (-not $SkipSql) {
    Write-Host "Starting SQL Server container..."
    Push-Location $backendRoot
    try {
        docker compose up -d sqlserver
        $sqlContainer = docker compose ps -q sqlserver
        if ([string]::IsNullOrWhiteSpace($sqlContainer)) {
            throw "Could not find the SQL Server container created by docker compose."
        }

        Wait-DockerHealthy -ContainerName $sqlContainer
    }
    finally {
        Pop-Location
    }
}

if (-not $SkipAzurite) {
    if ((Test-PortListening -Port 10000) -and (Test-PortListening -Port 10001) -and (Test-PortListening -Port 10002)) {
        Write-Host "Azurite is already listening on ports 10000, 10001, and 10002."
    }
    else {
        $azuriteCommand = Get-Command azurite -ErrorAction SilentlyContinue
        if ($null -eq $azuriteCommand) {
            throw "Azurite was not found. Install it once with: npm install -g azurite"
        }

        Start-LoggedProcess `
            -Name "Azurite" `
            -FilePath $azuriteCommand.Source `
            -ArgumentList @(
                "--location", $azuriteRoot,
                "--debug", (Join-Path $logRoot "azurite-debug.log")
            ) `
            -WorkingDirectory $repoRoot `
            -OutLog (Join-Path $logRoot "azurite.log") `
            -ErrLog (Join-Path $logRoot "azurite.err.log")

        Wait-Port -Port 10000 -Name "Azurite blob service"
        Wait-Port -Port 10001 -Name "Azurite queue service"
        Wait-Port -Port 10002 -Name "Azurite table service"
    }
}

if ($ApplyMigrations) {
    Write-Host "Applying database migrations and seed data..."
    Push-Location $backendRoot
    try {
        dotnet run --project src/Alife.DbMigrator
    }
    finally {
        Pop-Location
    }
}

if (-not $SkipApi) {
    if (Test-PortListening -Port 7071) {
        Write-Host "Alife API is already listening on port 7071."
    }
    else {
        $funcCommand = Get-Command func -ErrorAction SilentlyContinue
        if ($null -eq $funcCommand) {
            throw "Azure Functions Core Tools was not found. Install it before starting the API."
        }

        Start-LoggedProcess `
            -Name "Alife API" `
            -FilePath $funcCommand.Source `
            -ArgumentList @("start", "--port", "7071") `
            -WorkingDirectory $apiRoot `
            -OutLog (Join-Path $logRoot "api.log") `
            -ErrLog (Join-Path $logRoot "api.err.log")

        Wait-Port -Port 7071 -Name "Alife API" -TimeoutSeconds 120
    }
}

if (-not $SkipFrontend) {
    if (Test-PortListening -Port 5173) {
        Write-Host "Alife frontend is already listening on port 5173."
    }
    else {
        $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
        if ($null -eq $npmCommand) {
            $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
        }

        if ($null -eq $npmCommand) {
            throw "npm was not found. Install Node.js before starting the frontend."
        }

        $previousApiProxyTarget = $env:API_PROXY_TARGET
        $env:API_PROXY_TARGET = "http://127.0.0.1:7071"
        try {
            Start-LoggedProcess `
                -Name "Alife frontend" `
                -FilePath $npmCommand.Source `
                -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "5173") `
                -WorkingDirectory $frontendRoot `
                -OutLog (Join-Path $logRoot "frontend.log") `
                -ErrLog (Join-Path $logRoot "frontend.err.log")
        }
        finally {
            $env:API_PROXY_TARGET = $previousApiProxyTarget
        }

        Wait-Port -Port 5173 -Name "Alife frontend"
    }
}

Write-Host ""
Write-Host "Alife local dev stack is ready."
Write-Host "Frontend: http://localhost:5173"
Write-Host "API:      http://127.0.0.1:7071"
Write-Host "Logs:     $logRoot"
