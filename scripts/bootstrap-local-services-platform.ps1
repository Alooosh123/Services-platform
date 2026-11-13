[CmdletBinding()]
param(
    [string]$ProjectPath = 'D:\ServicesPlatform-production'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Write-Host '========== SAFE WINDOWS LOCAL BOOTSTRAP ==========' -ForegroundColor Cyan
$ProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path
Set-Location -LiteralPath $ProjectPath

foreach ($required in @('package.json', 'package-lock.json', '.env', 'docker/docker-compose.yml')) {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectPath $required) -PathType Leaf)) {
        throw "Missing required local file: $required. No source files were changed."
    }
}

$repository = 'Alooosh123/Services-platform'
$branch = 'fix/production-hardening-20261108'
$rawBase = "https://raw.githubusercontent.com/$repository/$branch"
$syncPath = Join-Path $ProjectPath 'sync-latest-branch-windows.ps1'
$tempPath = "$syncPath.download"
$syncUrl = "$rawBase/scripts/sync-latest-branch-windows.ps1"

Write-Host 'Downloading the current safe source-sync script...' -ForegroundColor Cyan
if (Test-Path -LiteralPath $tempPath) {
    Remove-Item -LiteralPath $tempPath -Force
}
& curl.exe -L --fail --retry 5 --retry-delay 3 --connect-timeout 30 --max-time 180 -o $tempPath $syncUrl
if ($LASTEXITCODE -ne 0) {
    throw 'Could not download the source-sync script from raw.githubusercontent.com. No project source files were changed.'
}
if (-not (Test-Path -LiteralPath $tempPath -PathType Leaf)) {
    throw 'Downloaded source-sync script is missing. No project source files were changed.'
}
$firstLine = Get-Content -LiteralPath $tempPath -TotalCount 1
if ($firstLine -ne '[CmdletBinding()]') {
    throw 'Downloaded source-sync script failed its basic format check. No project source files were changed.'
}

Move-Item -LiteralPath $tempPath -Destination $syncPath -Force
Unblock-File -LiteralPath $syncPath

Write-Host ''
Write-Host 'STEP 1/2 — Refresh source, preserving local environment and Docker settings' -ForegroundColor Green
& $syncPath -ProjectPath $ProjectPath

$completePath = Join-Path $ProjectPath 'scripts/complete-local-services-platform.ps1'
if (-not (Test-Path -LiteralPath $completePath -PathType Leaf)) {
    throw 'The source refresh completed without the local completion script. Review the source-sync output.'
}
Unblock-File -LiteralPath $completePath

Write-Host ''
Write-Host 'STEP 2/2 — Install, backup, restore-test, migrate, build and smoke-test local services' -ForegroundColor Green
& $completePath -ProjectPath $ProjectPath

Write-Host ''
Write-Host 'WINDOWS LOCAL BOOTSTRAP FINISHED' -ForegroundColor Green
Write-Host 'Review the local completion summary, then manually verify the customer and admin flows in your browser.'
Write-Host 'This script does not configure external provider contracts, merchant credentials, production deployment, or real payments.' -ForegroundColor Yellow
