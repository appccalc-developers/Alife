$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot '../start-local-dev.ps1'
$tokens = $null; $parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $path), [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
foreach ($name in @('Get-ListeningProcessIds', 'Test-PortListening', 'Assert-FrontendFallbackPortIsFree')) {
    $definition = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
    if (-not $definition) { throw "Missing helper: $name" }
    Invoke-Expression $definition.Extent.Text
}
# Mocks run only in this test process. Never inspect or terminate real listeners.
$script:listeners = @(); $script:netstatRows = @()
function Get-NetTCPConnection { param($LocalPort, $State, $ErrorAction) return $script:listeners }
function netstat { return $script:netstatRows }
function Get-Process { param($Id, $ErrorAction) return [pscustomobject]@{ ProcessName = 'fixture' } }
if (Test-PortListening -Port 5174) { throw 'Empty port reported busy' }
Assert-FrontendFallbackPortIsFree
$script:listeners = @([pscustomobject]@{ OwningProcess = 777 }, [pscustomobject]@{ OwningProcess = 777 })
if (@(Get-ListeningProcessIds -Port 5174).Count -ne 1) { throw 'Listener IDs were not deduplicated' }
$blocked = $false
try { Assert-FrontendFallbackPortIsFree } catch { if ($_.Exception.Message -notlike '*Port 5174*PID 777*') { throw }; $blocked = $true }
if (-not $blocked) { throw 'Busy fallback port was not rejected' }
$script:listeners = @()
$script:netstatRows = @('  TCP    127.0.0.1:5174    0.0.0.0:0    LISTENING    888')
if (@(Get-ListeningProcessIds -Port 5174)[0] -ne 888) { throw 'netstat fallback did not resolve listener' }
Write-Output 'PASS local-dev parser and 4 bounded listener/startup assertions; no services started or stopped.'
