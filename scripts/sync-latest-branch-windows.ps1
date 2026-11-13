[CmdletBinding()]
param(
    [string]$ProjectPath = 'D:\ServicesPlatform-production'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repository = 'Alooosh123/Services-platform'
$branch = 'fix/production-hardening-20261108'
$cloneUrl = "https://github.com/$repository.git"

Write-Host '========== SAFE SOURCE REFRESH (GIT TRANSPORT) ==========' -ForegroundColor Cyan
$ProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path
Set-Location -LiteralPath $ProjectPath

$envPath = Join-Path $ProjectPath '.env'
$composePath = Join-Path $ProjectPath 'docker/docker-compose.yml'
foreach ($required in @('package.json', 'package-lock.json', '.env', 'docker/docker-compose.yml')) {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectPath $required) -PathType Leaf)) {
        throw "Missing required local file: $required"
    }
}

$git = Get-Command git.exe -ErrorAction SilentlyContinue
if (-not $git) {
    $git = Get-Command git -ErrorAction SilentlyContinue
}
if (-not $git) {
    throw 'Git for Windows is not installed or not on PATH. Install Git for Windows, reopen PowerShell, and rerun this script. No project files were changed.'
}

$gitVersion = & $git.Source --version
if ($LASTEXITCODE -ne 0) { throw 'Git is present but could not run. No project files were changed.' }
Write-Host "Using $gitVersion"

$envHashBefore = (Get-FileHash -LiteralPath $envPath -Algorithm SHA256).Hash
$composeHashBefore = (Get-FileHash -LiteralPath $composePath -Algorithm SHA256).Hash

$runRoot = Join-Path $ProjectPath '.local-run'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stage = Join-Path $runRoot "source-sync-$stamp"
$sourceRoot = Join-Path $stage 'repository'
$backup = Join-Path $runRoot "source-metadata-backup-$stamp"
New-Item -ItemType Directory -Force -Path $runRoot, $stage, $backup | Out-Null

Write-Host "Cloning shallow copy of branch: $branch"
$cloneSucceeded = $false
$protocols = @('HTTP/1.1', 'HTTP/2')
foreach ($protocol in $protocols) {
    if (Test-Path -LiteralPath $stage) {
        Get-ChildItem -LiteralPath $stage -Force | Remove-Item -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $sourceRoot | Out-Null
    Write-Host "Attempting Git transport with $protocol..."
    & $git.Source -c "http.version=$protocol" clone --depth 1 --single-branch --branch $branch $cloneUrl $sourceRoot
    $cloneExit = $LASTEXITCODE
    if ($cloneExit -eq 0) {
        $cloneSucceeded = $true
        break
    }
    Write-Warning "Git clone attempt using $protocol failed (exit $cloneExit)."
}
if (-not $cloneSucceeded) {
    throw 'Git clone could not reach GitHub after HTTP/1.1 and HTTP/2 attempts. No project source files were changed. Check VPN/proxy/firewall or network access to github.com.'
}

$head = (& $git.Source -C $sourceRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($head)) {
    throw 'Could not identify the downloaded Git commit. No project files were changed.'
}
$branchName = (& $git.Source -C $sourceRoot branch --show-current).Trim()
Write-Host "Fetched branch: $branchName"
Write-Host "Fetched commit: $head"

foreach ($file in @('package.json', 'package-lock.json', 'apps/web-admin/package.json', 'apps/web-customer/package.json', 'apps/web-saas/package.json', 'packages/database/prisma/schema.prisma')) {
    if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot $file) -PathType Leaf)) {
        throw "Cloned source is incomplete: $file. No project files were changed."
    }
}

function Get-LockPackageVersion {
    param(
        [Parameter(Mandatory = $true)][string]$LockPath,
        [Parameter(Mandatory = $true)][string]$PackagePath
    )

    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $node) { $node = Get-Command node -ErrorAction SilentlyContinue }
    if (-not $node) { throw 'Node.js is required to validate package-lock.json. No project source files were changed.' }

    # Run a temporary CommonJS file instead of node -e. PowerShell can strip
    # quotes from native -e arguments on Windows PowerShell 5.x.
    $parserPath = Join-Path ([System.IO.Path]::GetTempPath()) ('read-lock-version-' + [guid]::NewGuid().ToString('N') + '.cjs')
    $parserSource = @'
const fs = require("node:fs");
const lockPath = process.argv[2];
const packagePath = process.argv[3];
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
const item = lock.packages && lock.packages[packagePath];
if (!item || !item.version) {
  console.error("Package version not found: " + packagePath);
  process.exit(2);
}
process.stdout.write(String(item.version));
'@

    try {
        [System.IO.File]::WriteAllText(
            $parserPath,
            $parserSource,
            ([System.Text.UTF8Encoding]::new($false))
        )
        $version = & $node.Source $parserPath $LockPath $PackagePath
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0 -or [string]::IsNullOrWhiteSpace(($version -join ''))) {
            throw "Could not read locked version for $PackagePath from $LockPath. No project source files were changed."
        }
        return ($version -join '').Trim()
    }
    finally {
        Remove-Item -LiteralPath $parserPath -Force -ErrorAction SilentlyContinue
    }
}

$sourceLockPath = Join-Path $sourceRoot 'package-lock.json'
$nextLock = Get-LockPackageVersion -LockPath $sourceLockPath -PackagePath 'node_modules/next'
$reactLock = Get-LockPackageVersion -LockPath $sourceLockPath -PackagePath 'node_modules/react'
$reactDomLock = Get-LockPackageVersion -LockPath $sourceLockPath -PackagePath 'node_modules/react-dom'
if ($nextLock -ne '15.5.29' -or $reactLock -ne '19.3.1' -or $reactDomLock -ne '19.3.1') {
    throw "Unexpected locked frontend versions: Next=$nextLock React=$reactLock ReactDOM=$reactDomLock. No project files were changed."
}

$localNext = Get-LockPackageVersion -LockPath (Join-Path $ProjectPath 'package-lock.json') -PackagePath 'node_modules/next'
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
Write-Host 'Preserved: .env, docker/docker-compose.yml, .local-run, node_modules, build caches, and existing Git metadata.'

$robocopyArgs = @(
    $sourceRoot,
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

$updatedLockPath = Join-Path $ProjectPath 'package-lock.json'
$updatedNext = Get-LockPackageVersion -LockPath $updatedLockPath -PackagePath 'node_modules/next'
$updatedReact = Get-LockPackageVersion -LockPath $updatedLockPath -PackagePath 'node_modules/react'
$updatedReactDom = Get-LockPackageVersion -LockPath $updatedLockPath -PackagePath 'node_modules/react-dom'
if ($updatedNext -ne '15.5.29' -or $updatedReact -ne '19.3.1' -or $updatedReactDom -ne '19.3.1') {
    throw 'Updated lockfile version verification failed.'
}

$migrationRoot = Join-Path $ProjectPath 'packages/database/prisma/migrations'
$migrationCount = @(Get-ChildItem -LiteralPath $migrationRoot -Directory | Where-Object { $_.Name -match '^\d{14}_' }).Count

Write-Host ''
Write-Host 'SOURCE REFRESH COMPLETED' -ForegroundColor Green
Write-Host "Branch: $branch"
Write-Host "Commit: $head"
Write-Host "Next.js lock: $updatedNext"
Write-Host "React lock: $updatedReact"
Write-Host "React DOM lock: $updatedReactDom"
Write-Host "Prisma migration directories: $migrationCount"
Write-Host ".env preserved: $($envHashAfter -eq $envHashBefore)"
Write-Host "Local Docker Compose preserved: $($composeHashAfter -eq $composeHashBefore)"
Write-Host "Original root manifests backed up to: $backup"
Write-Host "Git source retained at: $sourceRoot"
Write-Host ''
Write-Host 'Next: run scripts/complete-local-services-platform.ps1. It will reinstall dependencies, apply only pending local migrations, and rebuild.' -ForegroundColor Yellow
