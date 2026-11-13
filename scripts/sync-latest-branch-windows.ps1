[CmdletBinding()]
param(
    [string]$ProjectPath = 'D:\ServicesPlatform-production'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repository = 'Alooosh123/Services-platform'
$branch = 'fix/production-hardening-20261108'
$archiveUrl = "https://github.com/$repository/archive/refs/heads/$branch.zip"

Write-Host '========== SAFE SOURCE REFRESH ==========' -ForegroundColor Cyan
$ProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path
Set-Location -LiteralPath $ProjectPath

$envPath = Join-Path $ProjectPath '.env'
$composePath = Join-Path $ProjectPath 'docker/docker-compose.yml'
foreach ($required in @('package.json', 'package-lock.json', '.env', 'docker/docker-compose.yml')) {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectPath $required) -PathType Leaf)) {
        throw "Missing required local file: $required"
    }
}

$envHashBefore = (Get-FileHash -LiteralPath $envPath -Algorithm SHA256).Hash
$composeHashBefore = (Get-FileHash -LiteralPath $composePath -Algorithm SHA256).Hash

$runRoot = Join-Path $ProjectPath '.local-run'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stage = Join-Path $runRoot "source-sync-$stamp"
$archive = Join-Path $runRoot "source-$stamp.zip"
$backup = Join-Path $runRoot "source-metadata-backup-$stamp"

New-Item -ItemType Directory -Force -Path $runRoot, $stage, $backup | Out-Null

Write-Host "Downloading branch source archive: $branch"
Invoke-WebRequest -Uri $archiveUrl -OutFile $archive -UseBasicParsing
if (-not (Test-Path -LiteralPath $archive) -or (Get-Item -LiteralPath $archive).Length -lt 100000) {
    throw 'GitHub archive is missing or unexpectedly small. No project files were changed.'
}

Write-Host 'Extracting source into isolated staging directory...'
Expand-Archive -LiteralPath $archive -DestinationPath $stage -Force
$sourceRoot = Get-ChildItem -LiteralPath $stage -Directory | Select-Object -First 1
if (-not $sourceRoot) { throw 'Archive root directory was not found.' }

foreach ($file in @('package.json', 'package-lock.json', 'apps/web-admin/package.json', 'apps/web-customer/package.json', 'apps/web-saas/package.json', 'packages/database/prisma/schema.prisma')) {
    if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot.FullName $file) -PathType Leaf)) {
        throw "Source archive is incomplete: $file. No project files were changed."
    }
}

$lock = Get-Content -LiteralPath (Join-Path $sourceRoot.FullName 'package-lock.json') -Raw | ConvertFrom-Json
$nextLock = $lock.packages.PSObject.Properties['node_modules/next'].Value.version
$reactLock = $lock.packages.PSObject.Properties['node_modules/react'].Value.version
$reactDomLock = $lock.packages.PSObject.Properties['node_modules/react-dom'].Value.version
if ($nextLock -ne '15.5.29' -or $reactLock -ne '19.3.1' -or $reactDomLock -ne '19.3.1') {
    throw "Unexpected locked frontend versions: Next=$nextLock React=$reactLock ReactDOM=$reactDomLock. No project files were changed."
}

$localLock = Get-Content -LiteralPath (Join-Path $ProjectPath 'package-lock.json') -Raw | ConvertFrom-Json
$localNext = $localLock.packages.PSObject.Properties['node_modules/next'].Value.version
Write-Host "Current local lock Next.js: $localNext"
Write-Host "Verified source lock: Next.js $nextLock / React $reactLock / ReactDOM $reactDomLock"

Copy-Item -LiteralPath (Join-Path $ProjectPath 'package.json') -Destination (Join-Path $backup 'package.json')
Copy-Item -LiteralPath (Join-Path $ProjectPath 'package-lock.json') -Destination (Join-Path $backup 'package-lock.json')

$sourceBackup = Join-Path $backup 'project-source'
New-Item -ItemType Directory -Force -Path $sourceBackup | Out-Null
Write-Host 'Creating a source-file backup before overlay...'
$backupArgs = @(
    $ProjectPath,
    $sourceBackup,
    '/E',
    '/COPY:DAT',
    '/DCOPY:DAT',
    '/R:2',
    '/W:1',
    '/NP',
    '/NFL',
    '/NDL',
    '/NJH',
    '/NJS',
    '/XD', '.git', 'node_modules', '.next', 'dist', 'coverage', '.local-run', '.dart_tool', 'build',
    '/XF', '.env', 'docker-compose.yml'
)
& robocopy @backupArgs
$backupCode = $LASTEXITCODE
if ($backupCode -ge 8) {
    throw "Source backup failed with Robocopy code $backupCode. No source overlay was started."
}

Write-Host ''
Write-Host 'Updating tracked source files while preserving local state...' -ForegroundColor Cyan
Write-Host 'Preserved: .env, docker/docker-compose.yml, .local-run, node_modules, build caches, and any existing Git metadata.'

$robocopyArgs = @(
    $sourceRoot.FullName,
    $ProjectPath,
    '/E',
    '/COPY:DAT',
    '/DCOPY:DAT',
    '/R:2',
    '/W:1',
    '/NP',
    '/NFL',
    '/NDL',
    '/NJH',
    '/NJS',
    '/XD', '.git', 'node_modules', '.next', 'dist', 'coverage', '.local-run', '.dart_tool', 'build',
    '/XF', '.env', 'docker-compose.yml'
)
& robocopy @robocopyArgs
$robocopyCode = $LASTEXITCODE
if ($robocopyCode -ge 8) {
    throw "Robocopy failed with code $robocopyCode. Review files before continuing. Metadata backup: $backup"
}

$envHashAfter = (Get-FileHash -LiteralPath $envPath -Algorithm SHA256).Hash
$composeHashAfter = (Get-FileHash -LiteralPath $composePath -Algorithm SHA256).Hash
if ($envHashAfter -ne $envHashBefore) { throw '.env changed unexpectedly. Stop and restore from your own backup.' }
if ($composeHashAfter -ne $composeHashBefore) { throw 'Local Docker Compose configuration changed unexpectedly.' }

$updatedLock = Get-Content -LiteralPath (Join-Path $ProjectPath 'package-lock.json') -Raw | ConvertFrom-Json
$updatedNext = $updatedLock.packages.PSObject.Properties['node_modules/next'].Value.version
$updatedReact = $updatedLock.packages.PSObject.Properties['node_modules/react'].Value.version
$updatedReactDom = $updatedLock.packages.PSObject.Properties['node_modules/react-dom'].Value.version
if ($updatedNext -ne '15.5.29' -or $updatedReact -ne '19.3.1' -or $updatedReactDom -ne '19.3.1') {
    throw 'Updated lockfile version verification failed.'
}

$migrationRoot = Join-Path $ProjectPath 'packages/database/prisma/migrations'
$migrationCount = @(Get-ChildItem -LiteralPath $migrationRoot -Directory | Where-Object { $_.Name -match '^\d{14}_' }).Count

Write-Host ''
Write-Host 'SOURCE REFRESH COMPLETED' -ForegroundColor Green
Write-Host "Branch: $branch"
Write-Host "Next.js lock: $updatedNext"
Write-Host "React lock: $updatedReact"
Write-Host "React DOM lock: $updatedReactDom"
Write-Host "Prisma migration directories: $migrationCount"
Write-Host ".env preserved: $($envHashAfter -eq $envHashBefore)"
Write-Host "Local Docker Compose preserved: $($composeHashAfter -eq $composeHashBefore)"
Write-Host "Original root manifests backed up to: $backup"
Write-Host "Source archive retained at: $archive"
Write-Host ''
Write-Host 'Next: run scripts/complete-local-services-platform.ps1. It will reinstall from the refreshed lockfile, apply only pending local migrations, and rebuild.' -ForegroundColor Yellow
