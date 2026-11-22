[CmdletBinding(SupportsShouldProcess=$true)]
param(
  [string]$TaskName = 'ServicesPlatform-Encrypted-DB-Backup',
  [string]$BackupScript = (Join-Path $PSScriptRoot 'backup-db.ps1'),
  [datetime]$DailyAt = [datetime]::Today.AddHours(1).AddMinutes(15)
)
$ErrorActionPreference='Stop'

foreach ($name in @('DATABASE_URL','SP_BACKUP_PASSPHRASE','SP_BACKUP_DIR','SP_N8N_BACKUP_WEBHOOK','SP_N8N_AGENT_TOKEN')) {
  if (-not [Environment]::GetEnvironmentVariable($name,'User') -and -not [Environment]::GetEnvironmentVariable($name,'Machine') -and -not (Get-Item "Env:$name" -ErrorAction SilentlyContinue)) {
    throw "Required environment variable '$name' is missing. Set it securely before registering the scheduled task."
  }
}
if (-not (Test-Path $BackupScript)) { throw "Backup script not found: $BackupScript" }
$powerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$quotedScript = '"' + $BackupScript + '"'
$action = New-ScheduledTaskAction -Execute $powerShell -Argument "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $quotedScript"
$trigger = New-ScheduledTaskTrigger -Daily -At $DailyAt
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Encrypted PostgreSQL backup for Services-platform. Restore is a separate verified drill.'
if ($PSCmdlet.ShouldProcess($TaskName,'Register or replace Windows scheduled task')) {
  Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null
  Write-Output "Registered '$TaskName' to run daily at $DailyAt (local Windows time). This task runs only while the configured user is logged on."
}
