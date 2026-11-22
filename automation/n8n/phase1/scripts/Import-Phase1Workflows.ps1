[CmdletBinding(SupportsShouldProcess=$true,ConfirmImpact='High')]
param(
  [string]$WorkflowDir = (Join-Path $PSScriptRoot '..\workflows'),
  [string]$BackupRoot = (Join-Path $PSScriptRoot '..\n8n-import-backups'),
  [switch]$SkipExistingWorkflowBackup
)
$ErrorActionPreference = 'Stop'

$n8nCommand = Get-Command n8n -ErrorAction SilentlyContinue
if (-not $n8nCommand) {
  throw 'The n8n Server CLI command was not found. Run this on the Windows account that owns the local n8n installation, or use the documented Docker CLI method for a containerized instance.'
}
if (-not (Test-Path -LiteralPath $WorkflowDir -PathType Container)) {
  throw "Workflow directory not found: $WorkflowDir"
}

$files = @(Get-ChildItem -LiteralPath $WorkflowDir -Filter '*.json' -File | Sort-Object Name)
if ($files.Count -ne 7) {
  throw "Expected exactly 7 Phase 1 workflow JSON files; found $($files.Count). Refusing import."
}

foreach ($file in $files) {
  $workflow = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
  if (-not $workflow.name -or -not $workflow.nodes -or -not $workflow.connections) {
    throw "Invalid workflow export structure: $($file.Name)"
  }
  if ($workflow.active -eq $true) {
    throw "Workflow must be inactive before import: $($file.Name)"
  }
}

$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmssZ')
$backupDir = Join-Path $BackupRoot $stamp
$stagingDir = Join-Path ([IO.Path]::GetTempPath()) ("sp-n8n-phase1-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null

try {
  foreach ($file in $files) {
    $workflow = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
    $workflow.active = $false
    $json = $workflow | ConvertTo-Json -Depth 100
    $target = Join-Path $stagingDir $file.Name
    [IO.File]::WriteAllText($target, $json, (New-Object System.Text.UTF8Encoding($false)))
  }

  if (-not $SkipExistingWorkflowBackup) {
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    if ($PSCmdlet.ShouldProcess($backupDir, 'Export current n8n workflows before importing Phase 1')) {
      & $n8nCommand.Source export:workflow --backup "--output=$backupDir"
      if ($LASTEXITCODE -ne 0) {
        throw "Existing n8n workflow backup failed (exit code $LASTEXITCODE). Import aborted."
      }
    } else {
      Write-Warning 'Backup export was skipped by WhatIf/confirmation. No workflows were imported.'
      return
    }
  }

  $inputPath = (Resolve-Path -LiteralPath $stagingDir).Path
  $arguments = @('import:workflow','--separate',"--input=$inputPath",'--activeState=false')
  if ($PSCmdlet.ShouldProcess('Local n8n database', "Import $($files.Count) Phase 1 workflows as inactive drafts")) {
    & $n8nCommand.Source @arguments
    if ($LASTEXITCODE -ne 0) {
      throw "n8n workflow import failed (exit code $LASTEXITCODE). Do not publish any Phase 1 workflows."
    }
    Write-Output "Imported $($files.Count) Phase 1 workflows as inactive drafts."
    if (-not $SkipExistingWorkflowBackup) {
      Write-Output "Existing-workflow backup directory: $backupDir"
    }
    Write-Output 'Next: open n8n, bind Header Auth and Telegram credentials, inspect each workflow, then run manual test executions.'
    Write-Output 'No workflow was published or activated by this script.'
  }
}
finally {
  if (Test-Path -LiteralPath $stagingDir) {
    Remove-Item -LiteralPath $stagingDir -Recurse -Force
  }
}
