[CmdletBinding(SupportsShouldProcess=$true,ConfirmImpact='High')]
param(
  [Parameter(Mandatory=$true)][string]$WorkflowDir,
  [string]$BackupRoot = (Join-Path $env:USERPROFILE 'Documents\ServicesPlatform-n8n-backups'),
  [switch]$SkipExistingWorkflowBackup
)
$ErrorActionPreference = 'Stop'

# Run only AFTER Phase 1 has been imported and its smoke tests pass.
# Imports ten additional workflows and excludes the seven common Phase 1 workflows.
$additional = @(
  '04_WALLET_DEPOSIT_INTAKE.json',
  '05_FINANCIAL_RECONCILIATION.json',
  '06_DAILY_FINANCE_REPORT_SCHEDULE.json',
  '06_EARNINGS_DAILY_REPORT.json',
  '07_FULFILLMENT_MONITOR.json',
  '08_CUSTOMER_SUPPORT.json',
  '09_FRAUD_SECURITY.json',
  '10_ACCOUNT_LINKING_REVIEW.json',
  '11_QA_DEVOPS.json',
  '13_APPROVAL_NOTIFIER.json'
)

$n8nCommand = Get-Command n8n -ErrorAction SilentlyContinue
if (-not $n8nCommand) {
  throw 'n8n Server CLI was not found. Run on the host that owns local n8n, or use the CLI inside the n8n container.'
}
if (-not (Test-Path -LiteralPath $WorkflowDir -PathType Container)) {
  throw "Workflow directory not found: $WorkflowDir"
}
$missing = @($additional | Where-Object {
  -not (Test-Path -LiteralPath (Join-Path $WorkflowDir $_) -PathType Leaf)
})
if ($missing.Count -gt 0) {
  throw "Required workflow files are missing: $($missing -join ', ')"
}

$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmssZ')
$backupDir = Join-Path $BackupRoot $stamp
$stagingDir = Join-Path ([IO.Path]::GetTempPath()) ("sp-n8n-agents-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null

try {
  foreach ($name in $additional) {
    $source = Join-Path $WorkflowDir $name
    $workflow = Get-Content -LiteralPath $source -Raw | ConvertFrom-Json
    if (-not $workflow.name -or -not $workflow.nodes -or -not $workflow.connections) {
      throw "Invalid workflow export: $name"
    }
    $workflow.active = $false
    $target = Join-Path $stagingDir $name
    [IO.File]::WriteAllText(
      $target,
      ($workflow | ConvertTo-Json -Depth 100),
      (New-Object System.Text.UTF8Encoding($false))
    )
  }

  if (-not $SkipExistingWorkflowBackup) {
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    if (-not $PSCmdlet.ShouldProcess($backupDir, 'Export current n8n workflows before importing additional agents')) {
      Write-Warning 'Backup/import not approved; no workflows were imported.'
      return
    }
    & $n8nCommand.Source export:workflow --backup "--output=$backupDir"
    if ($LASTEXITCODE -ne 0) {
      throw "Workflow export failed (exit code $LASTEXITCODE). Import aborted."
    }
  }

  $inputPath = (Resolve-Path -LiteralPath $stagingDir).Path
  # n8n CLI supports --activeState=false; imports remain inactive.
  $arguments = @('import:workflow','--separate',"--input=$inputPath",'--activeState=false')
  if ($PSCmdlet.ShouldProcess('Local n8n database', 'Import ten additional agent workflows as inactive drafts')) {
    & $n8nCommand.Source @arguments
    if ($LASTEXITCODE -ne 0) {
      throw "n8n import failed (exit code $LASTEXITCODE). No workflow was published by this script."
    }
    Write-Output "Imported $($additional.Count) additional workflows as inactive drafts."
    if (-not $SkipExistingWorkflowBackup) {
      Write-Output "Existing workflow export: $backupDir"
    }
    Write-Output 'No workflow was published or activated. Bind Credentials and validate each workflow in the n8n editor.'
  }
}
finally {
  if (Test-Path -LiteralPath $stagingDir) {
    Remove-Item -LiteralPath $stagingDir -Recurse -Force
  }
}
