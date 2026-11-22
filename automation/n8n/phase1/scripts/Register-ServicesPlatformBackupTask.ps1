[CmdletBinding(SupportsShouldProcess=$true)]
param(
  [string]$TaskName = 'ServicesPlatform-Encrypted-DB-Backup',
  [string]$BackupScript = (Join-Path $PSScriptRoot 'backup-db.ps1'),
  [datetime]$DailyAt = [datetime]::Today.AddHours(1).AddMinutes(15)
)
$ErrorActionPreference='Stop'

function Get-PersistedSetting([string]$Name) {
  $user = [Environment]::GetEnvironmentVariable($Name,'User')
  if ($user) { return $user }
  return [Environment]::GetEnvironmentVariable($Name,'Machine')
}

# Task Scheduler does not inherit variables that exist only in this PowerShell
# process. Require the database URL and backup passphrase in the current user's
# environment (preferred) or machine environment before registering the task.
foreach ($name in @('DATABASE_URL','SP_BACKUP_PASSPHRASE')) {
  $value = Get-PersistedSetting -Name $name
  if (-not $value) {
    throw "Persist '$name' in Windows User environment (preferred) or Machine environment, then rerun this script."
  }
}
$passphrase = Get-PersistedSetting -Name 'SP_BACKUP_PASSPHRASE'
if ($passphrase.Length -lt 24) { throw 'Persisted SP_BACKUP_PASSPHRASE must contain at least 24 characters.' }

$webhook = Get-PersistedSetting -Name 'SP_N8N_BACKUP_WEBHOOK'
$token = Get-PersistedSetting -Name 'SP_N8N_AGENT_TOKEN'
if ([bool]$webhook -xor [bool]$token) {
  throw 'Persist both SP_N8N_BACKUP_WEBHOOK and SP_N8N_AGENT_TOKEN, or leave both unset.'
}
if ($token -and $token.Length -lt 32) { throw 'Persisted SP_N8N_AGENT_TOKEN must contain at least 32 characters.' }
if (-not (Test-Path -LiteralPath $BackupScript)) { throw "Backup script not found: $BackupScript" }

$powerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$quotedScript = '"' + (Resolve-Path -LiteralPath $BackupScript).Path + '"'
$action = New-ScheduledTaskAction -Execute $powerShell -Argument "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $quotedScript"
$trigger = New-ScheduledTaskTrigger -Daily -At $DailyAt
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Encrypted PostgreSQL backup for Services-platform. Restore is a separate verified drill.'

if ($PSCmdlet.ShouldProcess($TaskName,'Register or replace Windows scheduled task')) {
  Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null
  Write-Output "Registered '$TaskName' to run daily at $DailyAt (local Windows time)."
  Write-Output 'The task runs as the current user only when that user is logged on. Secrets are read from the persisted Windows environment; values are never printed.'
}
