[CmdletBinding()]
param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$BackupDir = $(if ($env:SP_BACKUP_DIR) { $env:SP_BACKUP_DIR } else { Join-Path $PSScriptRoot 'backups' })
)
$ErrorActionPreference = 'Stop'

function Get-HmacSha256Hex([string]$Path, [string]$Passphrase) {
  $key = [Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($Passphrase))
  $hmac = [Security.Cryptography.HMACSHA256]::new($key)
  $stream = [IO.File]::OpenRead($Path)
  try { $bytes = $hmac.ComputeHash($stream); return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant() }
  finally { $stream.Dispose(); $hmac.Dispose() }
}

if (-not $DatabaseUrl) { throw 'DATABASE_URL is required.' }
if (-not $env:SP_BACKUP_PASSPHRASE -or $env:SP_BACKUP_PASSPHRASE.Length -lt 24) { throw 'SP_BACKUP_PASSPHRASE must contain at least 24 characters.' }
# Prisma URLs often include schema=public, which libpq tools do not understand.
$LibpqDatabaseUrl = [regex]::Replace($DatabaseUrl, '([?&])schema=[^&]*', '')
$LibpqDatabaseUrl = $LibpqDatabaseUrl -replace '\?&', '?' -replace '[?&]$', ''
$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
$openssl = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $pgDump) { throw 'pg_dump was not found on PATH.' }
if (-not $pgRestore) { throw 'pg_restore was not found on PATH.' }
if (-not $openssl) { throw 'openssl was not found on PATH.' }
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmssZ')
$plain = Join-Path $BackupDir "services-platform-$stamp.dump"
$enc = "$plain.enc"
$manifest = "$enc.manifest.json"
try {
  & $pgDump.Source --dbname=$LibpqDatabaseUrl --format=custom --no-owner --no-acl --file=$plain
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $plain)) { throw 'pg_dump failed.' }
  & $pgRestore.Source --list $plain | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'The PostgreSQL dump archive failed validation.' }
  & $openssl.Source enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -md sha256 -in $plain -out $enc -pass 'env:SP_BACKUP_PASSPHRASE'
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $enc)) { throw 'OpenSSL encryption failed.' }
  $hash = (Get-FileHash -Algorithm SHA256 $enc).Hash.ToLowerInvariant()
  $hmacHex = Get-HmacSha256Hex -Path $enc -Passphrase $env:SP_BACKUP_PASSPHRASE
  $obj = [ordered]@{
    status='BACKUP_CREATED'; createdAt=(Get-Date).ToUniversalTime().ToString('o')
    encryptedFile=(Split-Path $enc -Leaf); sha256=$hash; hmacSha256=$hmacHex
    sizeBytes=(Get-Item $enc).Length; encryption='AES-256-CBC + PBKDF2-HMAC-SHA256'
    iterations=200000; restoreVerified=$false
    note='Encrypted archive and integrity proof created. Restore verification is a separate drill.'
  }
  $obj | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $manifest
  $notificationStatus = 'NOT_CONFIGURED'
  if ($env:SP_N8N_BACKUP_WEBHOOK -and $env:SP_N8N_AGENT_TOKEN) {
    try {
      $event = @{
        eventId="backup-$stamp"; eventType='backup.result.created'; status='BACKUP_CREATED'
        sha256=$hash; hmacSha256=$hmacHex; manifest=(Split-Path $manifest -Leaf)
        sizeBytes=(Get-Item $enc).Length; restoreVerified=$false
        occurredAt=(Get-Date).ToUniversalTime().ToString('o')
      }
      Invoke-RestMethod -Method Post -Uri $env:SP_N8N_BACKUP_WEBHOOK -Headers @{'X-SP-Agent-Token'=$env:SP_N8N_AGENT_TOKEN} -ContentType 'application/json' -Body ($event | ConvertTo-Json -Depth 5) -TimeoutSec 10 | Out-Null
      $notificationStatus = 'SENT'
    } catch { $notificationStatus = 'FAILED: ' + $_.Exception.Message }
  }
  $obj['notificationStatus'] = $notificationStatus
  $obj | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $manifest
  $obj | ConvertTo-Json -Depth 5 | Write-Output
}
finally {
  if (Test-Path $plain) { Remove-Item -Force $plain }
}
