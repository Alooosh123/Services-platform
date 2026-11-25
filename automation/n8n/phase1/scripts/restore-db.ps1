[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$EncryptedBackup,
  [Parameter(Mandatory=$true)][string]$RestoreDatabaseUrl,
  [string]$LedgerVerificationSql = (Join-Path $PSScriptRoot 'ledger-verification.sql'),
  [Nullable[int]]$RpoSecondsObserved = $null
)
$ErrorActionPreference='Stop'

function Get-HmacSha256Hex([string]$Path, [string]$Passphrase) {
  $key = [Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($Passphrase))
  $hmac = [Security.Cryptography.HMACSHA256]::new($key)
  $stream = [IO.File]::OpenRead($Path)
  try { $bytes = $hmac.ComputeHash($stream); return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant() }
  finally { $stream.Dispose(); $hmac.Dispose() }
}

if (-not $env:SP_BACKUP_PASSPHRASE -or $env:SP_BACKUP_PASSPHRASE.Length -lt 24) { throw 'SP_BACKUP_PASSPHRASE must contain at least 24 characters.' }
foreach ($tool in @('openssl','pg_restore','psql')) { if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool was not found on PATH." } }
if ($RestoreDatabaseUrl -notmatch '@(localhost|127\.0\.0\.1|\[::1\])[:/]') {
  throw 'Restore target does not look local. Use a disposable isolated local database. Remote/production restore is not supported by this phase-1 script.'
}
$targetDbName = ([uri]$RestoreDatabaseUrl).AbsolutePath.Trim('/')
if ($targetDbName -notmatch '(?i)(restore|drill|test)$') {
  throw "Restore database name '$targetDbName' must end with restore, drill, or test."
}
$LibpqRestoreDatabaseUrl = [regex]::Replace($RestoreDatabaseUrl, '([?&])schema=[^&]*', '')
$LibpqRestoreDatabaseUrl = $LibpqRestoreDatabaseUrl -replace '\?&', '?' -replace '[?&]$', ''
if (-not (Test-Path $EncryptedBackup)) { throw 'Encrypted backup file was not found.' }
$manifestPath="$EncryptedBackup.manifest.json"
if (-not (Test-Path $manifestPath)) { throw 'Backup manifest is missing. Restore aborted.' }
$manifest=Get-Content $manifestPath -Raw | ConvertFrom-Json
$actualSha=(Get-FileHash -Algorithm SHA256 $EncryptedBackup).Hash.ToLowerInvariant()
if ($manifest.sha256 -and $manifest.sha256 -ne $actualSha) { throw 'SHA-256 manifest mismatch. Restore aborted.' }
$actualHmac=Get-HmacSha256Hex -Path $EncryptedBackup -Passphrase $env:SP_BACKUP_PASSPHRASE
if (-not $manifest.hmacSha256 -or $manifest.hmacSha256 -ne $actualHmac) { throw 'HMAC integrity verification failed. Restore aborted.' }
$tmp=Join-Path ([IO.Path]::GetTempPath()) ("sp-restore-" + [guid]::NewGuid().ToString('N') + '.dump')
$started=Get-Date
try {
  & (Get-Command openssl).Source enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -in $EncryptedBackup -out $tmp -pass 'env:SP_BACKUP_PASSPHRASE'
  if ($LASTEXITCODE -ne 0) { throw 'Decryption failed; wrong passphrase or corrupted backup.' }
  & (Get-Command pg_restore).Source --list $tmp | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Archive validation failed.' }
  & (Get-Command pg_restore).Source --dbname=$LibpqRestoreDatabaseUrl --clean --if-exists --no-owner --no-acl --exit-on-error $tmp
  if ($LASTEXITCODE -ne 0) { throw 'pg_restore failed.' }
  $mismatch = & (Get-Command psql).Source --dbname=$LibpqRestoreDatabaseUrl --no-psqlrc --quiet --tuples-only --set=ON_ERROR_STOP=1 --file=$LedgerVerificationSql 2>&1
  if ($LASTEXITCODE -ne 0) { throw "Ledger verification query failed: $mismatch" }
  $mismatchText = ($mismatch | Out-String).Trim()
  if ($mismatchText.Length -gt 0) { throw "Ledger verification found unbalanced journals: $mismatchText" }
  $ledgerCount = & (Get-Command psql).Source --dbname=$LibpqRestoreDatabaseUrl --no-psqlrc --quiet --tuples-only --set=ON_ERROR_STOP=1 --command='SELECT COUNT(*) FROM ledger_transactions;' 2>&1
  if ($LASTEXITCODE -ne 0) { throw "Unable to count restored ledger transactions: $ledgerCount" }
  $rto = [int][Math]::Ceiling(((Get-Date)-$started).TotalSeconds)
  $event = @{
    eventId="restore-$([guid]::NewGuid().ToString('N'))"; eventType='backup.restore.verified'
    status='RESTORE_VERIFIED'; sha256=$actualSha; restoreVerified=$true; ledgerBalanced=$true
    ledgerTransactionCount=[int]($ledgerCount | Out-String).Trim(); rtoSeconds=$rto
    rpoSeconds=$RpoSecondsObserved; occurredAt=(Get-Date).ToUniversalTime().ToString('o')
  }
  $notificationStatus='NOT_CONFIGURED'
  if ($env:SP_N8N_BACKUP_WEBHOOK -and $env:SP_N8N_AGENT_TOKEN) {
    try {
      Invoke-RestMethod -Method Post -Uri $env:SP_N8N_BACKUP_WEBHOOK -Headers @{'X-SP-Agent-Token'=$env:SP_N8N_AGENT_TOKEN} -ContentType 'application/json' -Body ($event | ConvertTo-Json -Depth 5) -TimeoutSec 10 | Out-Null
      $notificationStatus='SENT'
    } catch { $notificationStatus='FAILED: ' + $_.Exception.Message }
  }
  $event['notificationStatus']=$notificationStatus
  $event | ConvertTo-Json -Depth 5 | Write-Output
}
finally { if (Test-Path $tmp) { Remove-Item -Force $tmp } }
