[CmdletBinding()]
param(
    [switch]$ConfirmProduction,
    [string]$BackupDirectory = ".\backups\pre-migration"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH."
    }
}

if (-not $ConfirmProduction) {
    throw "Production migration is blocked. Re-run with -ConfirmProduction after reviewing the runbook."
}
if ($env:NODE_ENV -ne "production") {
    throw "NODE_ENV must be set to 'production'. No migration was attempted."
}
if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
    throw "DATABASE_URL is missing from the current process environment. No migration was attempted."
}
if ($env:DATABASE_URL -notmatch '^postgres(ql)?://') {
    throw "DATABASE_URL must be a PostgreSQL connection string. No migration was attempted."
}
if ($env:DATABASE_URL -match '@(localhost|127\.0\.0\.1|::1)(:|/)') {
    throw "The target resolves to a loopback host; this script is only for an explicitly configured production database."
}

$confirmation = Read-Host "Type APPLY-PRODUCTION-MIGRATIONS to confirm the target database"
if ($confirmation -cne "APPLY-PRODUCTION-MIGRATIONS") {
    throw "Confirmation text did not match. No migration was attempted."
}

Assert-Command "pg_dump"
Assert-Command "pg_restore"
Assert-Command "npx"

$schemaPath = ".\packages\database\prisma\schema.prisma"
if (-not (Test-Path $schemaPath)) {
    throw "Prisma schema was not found at $schemaPath. Run this script from the repository root."
}

$timestamp = [DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss")
$backupRoot = [System.IO.Path]::GetFullPath($BackupDirectory)
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$backupPath = Join-Path $backupRoot "production-before-migrate-$timestamp.dump"

Write-Host "Creating a custom-format PostgreSQL backup..." -ForegroundColor Cyan
& pg_dump --format=custom --no-owner --no-acl --file $backupPath --dbname $env:DATABASE_URL
if ($LASTEXITCODE -ne 0) {
    throw "pg_dump failed. No migration was attempted."
}
if (-not (Test-Path $backupPath) -or (Get-Item $backupPath).Length -lt 1024) {
    throw "Backup file is missing or unexpectedly small. No migration was attempted."
}

Write-Host "Verifying backup readability..." -ForegroundColor Cyan
$restoreListing = & pg_restore --list $backupPath 2>&1
if ($LASTEXITCODE -ne 0 -or -not ($restoreListing | Select-String -Quiet "Dumped from database version|TABLE DATA|TABLE")) {
    throw "pg_restore could not read the backup archive. No migration was attempted."
}
$backupHash = (Get-FileHash -Algorithm SHA256 -Path $backupPath).Hash
Write-Host "Backup verified. SHA256: $backupHash" -ForegroundColor Green
Write-Host "Backup file: $backupPath" -ForegroundColor Green

Write-Host "Checking existing Prisma migration history..." -ForegroundColor Cyan
$statusOutput = & npx prisma migrate status --schema=$schemaPath 2>&1
$statusCode = $LASTEXITCODE
$statusText = ($statusOutput | Out-String)
if ($statusCode -ne 0 -and $statusText -notmatch '(?i)not yet been applied|pending migration') {
    $statusOutput | ForEach-Object { Write-Host $_ }
    throw "Prisma migration status reported an error or drift. Backup is available; no migration was attempted."
}

Write-Host "Applying reviewed migrations..." -ForegroundColor Cyan
& npx prisma migrate deploy --schema=$schemaPath
if ($LASTEXITCODE -ne 0) {
    throw "Prisma migrate deploy failed. Do not retry blindly; inspect migration state and restore plan first. Backup: $backupPath"
}

Write-Host "Verifying migration history after deployment..." -ForegroundColor Cyan
& npx prisma migrate status --schema=$schemaPath
if ($LASTEXITCODE -ne 0) {
    throw "Post-deployment migration status is not clean. Stop production traffic changes and investigate immediately. Backup: $backupPath"
}

Write-Host "Production migrations completed and verified." -ForegroundColor Green
Write-Host "Retain this backup according to the production backup policy: $backupPath"
