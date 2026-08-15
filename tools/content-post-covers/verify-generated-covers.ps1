param(
    [string]$SiteUrl = 'https://ccalc.live',
    [string]$CoverDirectory = '',
    [string]$Category = ''
)

$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
if ([string]::IsNullOrWhiteSpace($CoverDirectory)) {
    $CoverDirectory = Join-Path $repositoryRoot 'cloudflare\alife-app\public\article-covers\generated'
}

$resolvedCoverDirectory = (Resolve-Path -LiteralPath $CoverDirectory).Path
$ffprobe = Get-Command ffprobe -ErrorAction Stop
$church = Invoke-RestMethod -Uri "$($SiteUrl.TrimEnd('/'))/api/groups/church"
$postResponse = Invoke-RestMethod -Uri "$($SiteUrl.TrimEnd('/'))/api/public/groups/$($church.id)/posts"
$posts = @($postResponse | ForEach-Object { $_ })
$scopedPosts = @(
    $posts |
        Where-Object { [string]::IsNullOrWhiteSpace($Category) -or $_.category -eq $Category }
)
$expectedSlugs = @(
    $scopedPosts |
        Where-Object { [string]::IsNullOrWhiteSpace($_.coverImageUrl) } |
        ForEach-Object { [string]$_.slug }
)
$scopedSlugs = @($scopedPosts | ForEach-Object { [string]$_.slug })
$allCoverFiles = @(Get-ChildItem -LiteralPath $resolvedCoverDirectory -Filter '*.webp' -File)
$coverFiles = if ([string]::IsNullOrWhiteSpace($Category)) {
    $allCoverFiles
} else {
    @($allCoverFiles | Where-Object { $_.BaseName -in $scopedSlugs })
}
$actualSlugs = @($coverFiles | Select-Object -ExpandProperty BaseName)

$missing = @($expectedSlugs | Where-Object { $_ -notin $actualSlugs })
$unexpected = @($actualSlugs | Where-Object { $_ -notin $expectedSlugs })
$invalid = @()

foreach ($coverFile in $coverFiles) {
    $probeText = & $ffprobe.Source `
        -v error `
        -select_streams v:0 `
        -show_entries stream=codec_name,width,height `
        -of json `
        $coverFile.FullName

    if ($LASTEXITCODE -ne 0) {
        $invalid += "$($coverFile.Name): ffprobe failed"
        continue
    }

    $probe = $probeText | ConvertFrom-Json
    $stream = @($probe.streams)[0]
    if ($stream.codec_name -ne 'webp' -or $stream.width -ne 960 -or $stream.height -ne 600) {
        $invalid += "$($coverFile.Name): $($stream.codec_name) $($stream.width)x$($stream.height)"
    }
}

$scopeLabel = if ([string]::IsNullOrWhiteSpace($Category)) { 'all categories' } else { "category '$Category'" }
Write-Output "Verification scope: $scopeLabel"
Write-Output "Expected missing-cover posts: $($expectedSlugs.Count)"
Write-Output "Generated WebP files in scope: $($coverFiles.Count)"

if ($missing.Count -gt 0) {
    Write-Output 'Missing covers:'
    $missing | ForEach-Object { Write-Output "  $_" }
}

if ($unexpected.Count -gt 0) {
    Write-Output 'Unexpected covers:'
    $unexpected | ForEach-Object { Write-Output "  $_" }
}

if ($invalid.Count -gt 0) {
    Write-Output 'Invalid cover files:'
    $invalid | ForEach-Object { Write-Output "  $_" }
}

if ($missing.Count -gt 0 -or $unexpected.Count -gt 0 -or $invalid.Count -gt 0) {
    exit 1
}

Write-Output 'All generated article covers are present and valid.'
