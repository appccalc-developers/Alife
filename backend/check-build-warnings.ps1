[CmdletBinding()]
param()

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$solution = Join-Path 'backend' 'Alife.sln'
$output = & dotnet build $solution -v minimal 2>&1
$output | ForEach-Object { Write-Output $_ }
$buildExitCode = $LASTEXITCODE

$patterns = @(
    'NU1510',
    'Model.Validation[20601]',
    'Model.Validation[10622]'
)

$hasFailingWarnings = $false
foreach ($pattern in $patterns)
{
    if ($output -match $pattern)
    {
        Write-Host "`n[FAIL] Found warning pattern: $pattern" -ForegroundColor Red
        $hasFailingWarnings = $true
    }
}

if ($buildExitCode -ne 0)
{
    Write-Host "`n[FAIL] dotnet build exited with code $buildExitCode." -ForegroundColor Red
    exit $buildExitCode
}

if ($hasFailingWarnings)
{
    exit 1
}

Write-Host "`nPASS: no tracked EF/NU warnings matched check patterns." -ForegroundColor Green
exit 0
