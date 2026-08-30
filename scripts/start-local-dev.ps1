param(
    [switch]$SkipSql,
    [switch]$SkipAzurite,
    [switch]$UseAzurite,
    [switch]$SkipApi,
    [switch]$SkipImagesApi,
    [switch]$SkipSpeedLayer,
    [switch]$SkipFrontend,
    [switch]$ApplyMigrations,
    [switch]$RebuildFrontendAssets,
    [switch]$EnableScheduledJobs
)

$ErrorActionPreference = "Stop"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptPath "..")
$backendRoot = Join-Path $repoRoot "backend"
$apiRoot = Join-Path $backendRoot "src\Alife.Api"
$frontendRoot = Join-Path $repoRoot "cloudflare\alife-app"
$imagesApiRoot = Join-Path $repoRoot "cloudflare\images-api"
$speedLayerRoot = Join-Path $repoRoot "cloudflare\speed-layer"
$runtimeRoot = Join-Path $repoRoot ".local-dev"
$logRoot = Join-Path $runtimeRoot "logs"
$azuriteRoot = Join-Path $runtimeRoot "azurite"
$wranglerStateRoot = Join-Path $runtimeRoot "wrangler"
$imagesWranglerStateRoot = Join-Path $runtimeRoot "images-wrangler"
$frontendDistRoot = Join-Path $frontendRoot "dist"

New-Item -ItemType Directory -Force -Path $logRoot, $azuriteRoot, $wranglerStateRoot, $imagesWranglerStateRoot | Out-Null

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

function Stop-ProcessesListeningOnPort {
    param(
        [int]$Port,
        [string]$Name,
        [int]$TimeoutSeconds = 30
    )

    $processIds = @(
        Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            Where-Object { $_.OwningProcess -gt 0 } |
            Select-Object -ExpandProperty OwningProcess -Unique
    )

    if ($processIds.Count -eq 0) {
        return
    }

    foreach ($processId in $processIds) {
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($null -eq $process) {
            continue
        }

        Write-Host "Stopping existing $Name on port $Port. PID $processId ($($process.ProcessName))."
        Stop-Process -Id $processId -Force -ErrorAction Stop
    }

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (-not (Test-PortListening -Port $Port)) {
            Write-Host "$Name stopped on port $Port."
            return
        }

        Start-Sleep -Seconds 1
    }

    throw "$Name did not stop listening on port $Port within $TimeoutSeconds seconds."
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

function Wait-ExistingSqlServer {
    param([int]$TimeoutSeconds = 120)

    Push-Location $backendRoot
    try {
        $sqlContainer = docker compose ps -q sqlserver 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($sqlContainer)) {
            Wait-DockerHealthy -ContainerName $sqlContainer -TimeoutSeconds $TimeoutSeconds
            return
        }
    }
    finally {
        Pop-Location
    }

    Wait-Port -Port 14333 -Name "SQL Server" -TimeoutSeconds $TimeoutSeconds
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

function Invoke-NativeCommand {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$WorkingDirectory
    )

    if (-not [string]::IsNullOrWhiteSpace($WorkingDirectory)) {
        Push-Location $WorkingDirectory
    }

    try {
        & $FilePath @ArgumentList
        if ($LASTEXITCODE -ne 0) {
            throw "$Name failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        if (-not [string]::IsNullOrWhiteSpace($WorkingDirectory)) {
            Pop-Location
        }
    }
}

function Get-NpmCommand {
    $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($null -eq $npmCommand) {
        $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
    }

    if ($null -eq $npmCommand) {
        throw "npm was not found. Install Node.js before starting the frontend or speed layer."
    }

    return $npmCommand
}

if (-not $SkipSql) {
    Write-Host "Starting SQL Server container..."
    Push-Location $backendRoot
    try {
        Invoke-NativeCommand `
            -Name "docker compose up sqlserver" `
            -FilePath "docker" `
            -ArgumentList @("compose", "up", "-d", "sqlserver") `
            -WorkingDirectory $null

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

if ($UseAzurite -and -not $SkipAzurite) {
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
else {
    Write-Host "Skipping Azurite. Scheduled Functions are disabled by default for local UI/API testing."
}

if ($ApplyMigrations) {
    if ($SkipSql) {
        Write-Host "Waiting for existing SQL Server before applying migrations..."
        Wait-ExistingSqlServer
    }

    Write-Host "Applying database migrations and seed data..."
    Invoke-NativeCommand `
        -Name "Alife.DbMigrator" `
        -FilePath "dotnet" `
        -ArgumentList @("run", "--project", "src/Alife.DbMigrator") `
        -WorkingDirectory $backendRoot
}

if (-not $SkipImagesApi) {
    Stop-ProcessesListeningOnPort -Port 8788 -Name "Alife images API"

    $wranglerCommand = Join-Path $speedLayerRoot "node_modules\.bin\wrangler.cmd"
    if (-not (Test-Path $wranglerCommand)) {
        throw "Wrangler was not found under cloudflare/speed-layer/node_modules. Run npm install in cloudflare/speed-layer first."
    }

    Start-LoggedProcess `
        -Name "Alife images API" `
        -FilePath $wranglerCommand `
        -ArgumentList @(
            "dev",
            "--config", (Join-Path $imagesApiRoot "wrangler.toml"),
            "--port", "8788",
            "--persist-to", $imagesWranglerStateRoot,
            "--show-interactive-dev-session=false"
        ) `
        -WorkingDirectory $imagesApiRoot `
        -OutLog (Join-Path $logRoot "images-api.log") `
        -ErrLog (Join-Path $logRoot "images-api.err.log")

    Wait-Port -Port 8788 -Name "Alife images API" -TimeoutSeconds 120
}

if (-not $SkipApi) {
    Stop-ProcessesListeningOnPort -Port 7071 -Name "Alife API"

    $funcCommand = Get-Command func -ErrorAction SilentlyContinue
    if ($null -eq $funcCommand) {
        throw "Azure Functions Core Tools was not found. Install it before starting the API."
    }

    $scheduledFunctionSetting = "AzureWebJobs.SermonSync.Disabled"
    $previousScheduledFunctionSetting = [Environment]::GetEnvironmentVariable($scheduledFunctionSetting, "Process")
    if (-not $EnableScheduledJobs) {
        [Environment]::SetEnvironmentVariable($scheduledFunctionSetting, "true", "Process")
    }

    try {
        Start-LoggedProcess `
            -Name "Alife API" `
            -FilePath $funcCommand.Source `
            -ArgumentList @("start", "--port", "7071") `
            -WorkingDirectory $apiRoot `
            -OutLog (Join-Path $logRoot "api.log") `
            -ErrLog (Join-Path $logRoot "api.err.log")
    }
    finally {
        [Environment]::SetEnvironmentVariable($scheduledFunctionSetting, $previousScheduledFunctionSetting, "Process")
    }

    Wait-Port -Port 7071 -Name "Alife API" -TimeoutSeconds 120
}

if (-not $SkipSpeedLayer) {
    $frontendIndex = Join-Path $frontendDistRoot "index.html"
    if ($RebuildFrontendAssets -or -not (Test-Path $frontendIndex)) {
        Write-Host "Building frontend assets for the Cloudflare speed layer..."
        $npmCommand = Get-NpmCommand
        Invoke-NativeCommand `
            -Name "frontend build" `
            -FilePath $npmCommand.Source `
            -ArgumentList @("run", "build") `
            -WorkingDirectory $frontendRoot
    }

    Stop-ProcessesListeningOnPort -Port 8787 -Name "Alife speed layer"

    $npmCommand = Get-NpmCommand
    $devVarsPath = Join-Path $speedLayerRoot ".dev.vars"
    if (-not (Test-Path $devVarsPath)) {
        Write-Warning "cloudflare/speed-layer/.dev.vars was not found. AI routes that require GEMINI_API_KEY may fail. Copy .dev.vars.example to .dev.vars and fill it in when needed."
    }

    $speedLayerArguments = @(
        "run", "dev", "--",
        "--port", "8787",
        "--persist-to", $wranglerStateRoot,
        "--show-interactive-dev-session=false",
        "--var", "API_PROXY_TARGET:http://127.0.0.1:7071",
        "--var", "CORS_ALLOWED_ORIGINS:http://localhost:5173,http://127.0.0.1:5173,http://localhost:8787,http://127.0.0.1:8787"
    )
    if (-not $SkipImagesApi) {
        $speedLayerArguments += @("--var", "IMAGES_API_PROXY_TARGET:http://127.0.0.1:8788")
    }

    Start-LoggedProcess `
        -Name "Alife speed layer" `
        -FilePath $npmCommand.Source `
        -ArgumentList $speedLayerArguments `
        -WorkingDirectory $speedLayerRoot `
        -OutLog (Join-Path $logRoot "speed-layer.log") `
        -ErrLog (Join-Path $logRoot "speed-layer.err.log")

    Wait-Port -Port 8787 -Name "Alife speed layer" -TimeoutSeconds 120
}

if (-not $SkipFrontend) {
    Stop-ProcessesListeningOnPort -Port 5173 -Name "Alife frontend"

    $npmCommand = Get-NpmCommand

    $previousApiProxyTarget = $env:API_PROXY_TARGET
    $previousAiProxyTarget = $env:AI_PROXY_TARGET
    $previousImagesProxyTarget = $env:IMAGES_PROXY_TARGET
    $previousImageApiBaseUrl = $env:VITE_IMAGE_API_BASE_URL
    $env:API_PROXY_TARGET = if ($SkipSpeedLayer) {
        "http://127.0.0.1:7071"
    }
    else {
        "http://127.0.0.1:8787"
    }
    $env:AI_PROXY_TARGET = "http://127.0.0.1:8787"
    if (-not $SkipImagesApi) {
        $env:IMAGES_PROXY_TARGET = "http://127.0.0.1:8788"
        $env:VITE_IMAGE_API_BASE_URL = "/images"
    }
    try {
        Start-LoggedProcess `
            -Name "Alife frontend" `
            -FilePath $npmCommand.Source `
            -ArgumentList @("run", "dev", "--", "--host", "localhost", "--port", "5173") `
            -WorkingDirectory $frontendRoot `
            -OutLog (Join-Path $logRoot "frontend.log") `
            -ErrLog (Join-Path $logRoot "frontend.err.log")
    }
    finally {
        $env:API_PROXY_TARGET = $previousApiProxyTarget
        $env:AI_PROXY_TARGET = $previousAiProxyTarget
        $env:IMAGES_PROXY_TARGET = $previousImagesProxyTarget
        $env:VITE_IMAGE_API_BASE_URL = $previousImageApiBaseUrl
    }

    Wait-Port -Port 5173 -Name "Alife frontend"
}

Write-Host ""
Write-Host "Alife local dev stack is ready."
Write-Host "Frontend:    http://localhost:5173"
Write-Host "Speed layer: http://localhost:8787"
if (-not $SkipImagesApi) {
    Write-Host "Images API:  http://127.0.0.1:8788"
}
Write-Host "API:         http://127.0.0.1:7071"
Write-Host "Logs:        $logRoot"
