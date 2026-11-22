[CmdletBinding()]
param(
  [string]$N8nBaseUrl = $(if ($env:N8N_BASE_URL) { $env:N8N_BASE_URL } else { 'http://127.0.0.1:5678' }),
  [string]$ApiBaseUrl = $(if ($env:SP_API_BASE_URL) { $env:SP_API_BASE_URL } else { 'http://127.0.0.1:4000' }),
  [switch]$RequireBackupTools
)
$ErrorActionPreference='Continue'
$results = [System.Collections.Generic.List[object]]::new()
function Add-Result([string]$Name,[bool]$Ok,[string]$Detail) { $results.Add([pscustomobject]@{Check=$Name;Status=$(if($Ok){'PASS'}else{'BLOCKED'});Detail=$Detail}) }

try { $r=Invoke-WebRequest -Uri "$N8nBaseUrl/healthz" -TimeoutSec 5 -UseBasicParsing; Add-Result 'n8n healthz' ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) "HTTP $($r.StatusCode)" } catch { Add-Result 'n8n healthz' $false $_.Exception.Message }
try { $r=Invoke-RestMethod -Uri "$ApiBaseUrl/api/health" -TimeoutSec 8; $s=[string]$r.status; Add-Result 'Backend health' ($s -eq 'HEALTHY') "status=$s" } catch { Add-Result 'Backend health' $false $_.Exception.Message }
$tokenOk = $env:SP_N8N_AGENT_TOKEN -and $env:SP_N8N_AGENT_TOKEN.Length -ge 32
Add-Result 'SP_N8N_AGENT_TOKEN' ([bool]$tokenOk) $(if($tokenOk){'Present; length OK (value hidden)'}else{'Missing or shorter than 32 characters'})
$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
$openssl = Get-Command openssl -ErrorAction SilentlyContinue
$toolsOk = [bool]$pgDump -and [bool]$pgRestore -and [bool]$openssl
Add-Result 'Backup tools' ($toolsOk -or -not $RequireBackupTools) "pg_dump=$([bool]$pgDump); pg_restore=$([bool]$pgRestore); openssl=$([bool]$openssl)"
$backupSecrets = $env:DATABASE_URL -and $env:SP_BACKUP_PASSPHRASE -and $env:SP_BACKUP_PASSPHRASE.Length -ge 24
Add-Result 'Backup environment' ([bool]$backupSecrets -or -not $RequireBackupTools) $(if($backupSecrets){'DATABASE_URL and passphrase present (values hidden)'}else{'DATABASE_URL or strong passphrase missing'})

$workflowDir = Join-Path $PSScriptRoot '..\workflows'
$jsonFiles = Get-ChildItem $workflowDir -Filter '*.json' -ErrorAction SilentlyContinue
$jsonValid = $true
foreach($f in $jsonFiles){ try { Get-Content $f.FullName -Raw | ConvertFrom-Json | Out-Null } catch { $jsonValid=$false; Add-Result "JSON $($f.Name)" $false $_.Exception.Message } }
if($jsonValid -and $jsonFiles.Count -gt 0){ Add-Result 'Workflow JSON syntax' $true "$($jsonFiles.Count) files parsed" }
elseif ($jsonFiles.Count -eq 0) { Add-Result 'Workflow JSON syntax' $false 'No workflow exports found beside the scripts.' }
$results | Format-Table -AutoSize
if (($results | Where-Object Status -eq 'BLOCKED').Count -gt 0) { exit 2 }
