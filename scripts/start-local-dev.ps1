param(
    [switch]$SkipSql,
    [switch]$SkipAzurite,
    [switch]$UseAzurite,
    [switch]$SkipApi,
    [switch]$SkipSpeedLayer,
    [switch]$SkipFrontend,
    [switch]$ApplyMigrations,
    [switch]$RebuildFrontendAssets,
    [switch]$EnableScheduledJobs,
    [string]$MobilePasskeyOrigin
)

$ErrorActionPreference = "Stop"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptPath "..")
$backendRoot = Join-Path $repoRoot "backend"
$apiRoot = Join-Path $backendRoot "src\Alife.Api"
$frontendRoot = Join-Path $repoRoot "cloudflare\alife-app"
$speedLayerRoot = Join-Path $repoRoot "cloudflare\speed-layer"
$runtimeRoot = Join-Path $repoRoot ".local-dev"
$logRoot = Join-Path $runtimeRoot "logs"
$azuriteRoot = Join-Path $runtimeRoot "azurite"
$wranglerStateRoot = Join-Path $runtimeRoot "wrangler"
$frontendDistRoot = Join-Path $frontendRoot "dist"

$mobilePasskeyUri = $null
$mobilePasskeyHost = $null
$normalizedMobilePasskeyOrigin = $null
if (-not [string]::IsNullOrWhiteSpace($MobilePasskeyOrigin)) {
    $candidateUri = $null
    if (-not [Uri]::TryCreate($MobilePasskeyOrigin, [UriKind]::Absolute, [ref]$candidateUri) -or
        $candidateUri.Scheme -ne "https" -or
        [string]::IsNullOrWhiteSpace($candidateUri.DnsSafeHost) -or
        $candidateUri.AbsolutePath -ne "/" -or
        -not [string]::IsNullOrEmpty($candidateUri.Query) -or
        -not [string]::IsNullOrEmpty($candidateUri.Fragment) -or
        -not [string]::IsNullOrEmpty($candidateUri.UserInfo)) {
        throw "MobilePasskeyOrigin must be an HTTPS origin without a path, query, fragment, or credentials (for example, https://example.trycloudflare.com)."
    }

    $mobilePasskeyUri = $candidateUri
    $mobilePasskeyHost = $candidateUri.DnsSafeHost
    $normalizedMobilePasskeyOrigin = $candidateUri.GetLeftPart([UriPartial]::Authority)
}

New-Item -ItemType Directory -Force -Path $logRoot, $azuriteRoot, $wranglerStateRoot | Out-Null

function Import-DotEnv {
    param([string]$Path)

    $importedNames = [System.Collections.Generic.List[string]]::new()

    if (-not (Test-Path -LiteralPath $Path)) {
        return $importedNames.ToArray()
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ($trimmed.Length -eq 0 -or $trimmed.StartsWith("#")) {
            continue
        }

        $separator = $trimmed.IndexOf('=')
        if ($separator -le 0) {
            continue
        }

        $name = $trimmed.Substring(0, $separator).Trim()
        $value = $trimmed.Substring($separator + 1).Trim()
        if ($value.Length -ge 2 -and
            (($value.StartsWith('"') -and $value.EndsWith('"')) -or
             ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        if ($null -eq [Environment]::GetEnvironmentVariable($name, "Process")) {
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
            $importedNames.Add($name)
        }
    }

    return $importedNames.ToArray()
}

function Remove-ImportedEnvironment {
    param([string[]]$Names)

    foreach ($name in $Names) {
        [Environment]::SetEnvironmentVariable($name, $null, "Process")
    }
}

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

# Azure Functions Core Tools does not read backend/.env itself. Import it only
# while starting backend children, then remove the imported values before any
# frontend or Worker process is launched. A mobile Passkey origin deliberately
# overrides the local RP configuration for the backend child only.
$mobileBackendEnvironment = @{}
if ($null -ne $mobilePasskeyUri) {
    $mobileBackendOverrides = [ordered]@{
        "Passkeys__Enabled" = "true"
        "Passkeys__RpId" = $mobilePasskeyHost
        "Passkeys__Origins__0" = $normalizedMobilePasskeyOrigin
        "Frontend__BaseUrl" = $normalizedMobilePasskeyOrigin
    }

    foreach ($entry in $mobileBackendOverrides.GetEnumerator()) {
        $mobileBackendEnvironment[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key, "Process")
        [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, "Process")
    }
}

$backendEnvironmentNames = @(Import-DotEnv -Path (Join-Path $backendRoot ".env"))

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

Remove-ImportedEnvironment -Names $backendEnvironmentNames
foreach ($entry in $mobileBackendEnvironment.GetEnumerator()) {
    [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, "Process")
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

    $corsAllowedOrigins = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8787,http://127.0.0.1:8787"
    if ($null -ne $mobilePasskeyUri) {
        $corsAllowedOrigins = "$corsAllowedOrigins,$normalizedMobilePasskeyOrigin"
    }

    Start-LoggedProcess `
        -Name "Alife speed layer" `
        -FilePath $npmCommand.Source `
        -ArgumentList @(
            "run", "dev", "--",
            "--port", "8787",
            "--persist-to", $wranglerStateRoot,
            "--show-interactive-dev-session=false",
            "--var", "API_PROXY_TARGET:http://127.0.0.1:7071",
            "--var", "CORS_ALLOWED_ORIGINS:$corsAllowedOrigins"
        ) `
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
    $previousPublicDevHost = $env:ALIFE_PUBLIC_DEV_HOST
    $env:API_PROXY_TARGET = if ($SkipSpeedLayer) {
        "http://127.0.0.1:7071"
    }
    else {
        "http://127.0.0.1:8787"
    }
    $env:AI_PROXY_TARGET = "http://127.0.0.1:8787"
    if ($null -ne $mobilePasskeyUri) {
        $env:ALIFE_PUBLIC_DEV_HOST = $mobilePasskeyHost
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
        $env:ALIFE_PUBLIC_DEV_HOST = $previousPublicDevHost
    }

    Wait-Port -Port 5173 -Name "Alife frontend"
}

Write-Host ""
Write-Host "Alife local dev stack is ready."
Write-Host "Frontend:    http://localhost:5173"
Write-Host "Speed layer: http://localhost:8787"
Write-Host "API:         http://127.0.0.1:7071"
if ($null -ne $mobilePasskeyUri) {
    Write-Host "Mobile URL:  $normalizedMobilePasskeyOrigin"
    Write-Host "Passkey RP:  $mobilePasskeyHost"
}
Write-Host "Logs:        $logRoot"
