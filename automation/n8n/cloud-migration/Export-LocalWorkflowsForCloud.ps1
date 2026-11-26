[CmdletBinding()]
param(
    [string]$OutputRoot = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'ServicesPlatform-n8n-cloud-migration')
)

$ErrorActionPreference = 'Stop'

# Export workflow definitions only. This deliberately does NOT export n8n credentials.
$n8nCommand = Get-Command 'n8n.cmd' -ErrorAction SilentlyContinue
if (-not $n8nCommand) {
    $n8nCommand = Get-Command 'n8n' -ErrorAction SilentlyContinue
}
if (-not $n8nCommand) {
    throw 'n8n CLI was not found in PATH. Open the same Windows account/environment used by your local n8n installation.'
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$runRoot = Join-Path $OutputRoot $stamp
$rawDir = Join-Path $runRoot 'source-workflows-private'
$safeDir = Join-Path $runRoot 'sanitized-workflows'
New-Item -ItemType Directory -Path $rawDir -Force | Out-Null
New-Item -ItemType Directory -Path $safeDir -Force | Out-Null

Write-Host "n8n executable: $($n8nCommand.Source)" -ForegroundColor Cyan
& $n8nCommand.Source 'export:workflow' '--all' '--separate' "--output=$rawDir"
if ($LASTEXITCODE -ne 0) {
    throw "n8n export:workflow failed with exit code $LASTEXITCODE"
}

$workflowFiles = @(Get-ChildItem -Path $rawDir -Filter '*.json' -File)
if ($workflowFiles.Count -eq 0) {
    throw 'No workflow JSON files were exported. Nothing has been prepared for transfer.'
}

$credentialAudit = New-Object System.Collections.Generic.List[object]
$workflowAudit = New-Object System.Collections.Generic.List[object]
$secretKeyPattern = '(?i)^(password|passwd|secret|clientsecret|accesstoken|refreshtoken|authorization|api[_-]?key|token)$'
$headerNamePattern = '(?i)(authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)'
$removedMarker = '[REMOVED - RECREATE AS N8N CREDENTIAL]'

function Protect-WorkflowObject {
    param([object]$Value, [string]$Path)

    if ($null -eq $Value) { return }

    if ($Value -is [System.Array]) {
        for ($i = 0; $i -lt $Value.Count; $i++) {
            Protect-WorkflowObject -Value $Value[$i] -Path "$Path[$i]"
        }
        return
    }

    if ($Value -is [pscustomobject]) {
        $properties = @($Value.PSObject.Properties)
        $nameProperty = $Value.PSObject.Properties['name']
        $valueProperty = $Value.PSObject.Properties['value']
        if ($nameProperty -and $valueProperty -and [string]$nameProperty.Value -match $headerNamePattern) {
            $valueProperty.Value = $removedMarker
        }

        foreach ($property in $properties) {
            if ($property.Name -match $secretKeyPattern) {
                if ($property.MemberType -eq 'NoteProperty' -or $property.MemberType -eq 'Property') {
                    try { $property.Value = $removedMarker } catch {}
                }
            }
            else {
                Protect-WorkflowObject -Value $property.Value -Path "$Path.$($property.Name)"
            }
        }
    }
}

foreach ($file in $workflowFiles) {
    $workflow = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
    $workflowName = [string]$workflow.name
    $nodes = @($workflow.nodes)
    $credentialCount = 0
    $unauthenticatedWebhooks = New-Object System.Collections.Generic.List[string]
    $localEndpoints = New-Object System.Collections.Generic.List[string]

    foreach ($node in $nodes) {
        if ($node.credentials) {
            foreach ($credentialProperty in $node.credentials.PSObject.Properties) {
                [void]$credentialAudit.Add([pscustomobject]@{
                    Workflow = $workflowName
                    Node = [string]$node.name
                    CredentialType = [string]$credentialProperty.Name
                    CredentialName = [string]$credentialProperty.Value.name
                    Action = 'Recreate and bind manually in target n8n'
                })
                $credentialCount++
            }
            $node.PSObject.Properties.Remove('credentials')
        }

        if ([string]$node.type -match 'webhook') {
            $auth = [string]$node.parameters.authentication
            if ([string]::IsNullOrWhiteSpace($auth) -or $auth -eq 'none') {
                [void]$unauthenticatedWebhooks.Add([string]$node.name)
            }
        }
    }

    if ($workflow.PSObject.Properties['active']) {
        $workflow.active = $false
    }
    else {
        $workflow | Add-Member -NotePropertyName active -NotePropertyValue $false
    }

    Protect-WorkflowObject -Value $workflow -Path $workflowName

    $serialized = $workflow | ConvertTo-Json -Depth 100
    if ($serialized -match '(?i)localhost|127\.0\.0\.1|host\.docker\.internal|ollama') {
        [void]$localEndpoints.Add('Workflow contains local/private endpoint references; review URLs before cloud import.')
    }
    if ($serialized -match '(?i)Bearer\s+[A-Za-z0-9._\-]{16,}|(?:sk_live_|sk_test_|ghp_|gho_|xox[baprs]-)[A-Za-z0-9_\-]{12,}') {
        [void]$localEndpoints.Add('Potential inline token pattern remains; manual secret review is required.')
    }

    $safePath = Join-Path $safeDir $file.Name
    Set-Content -LiteralPath $safePath -Value $serialized -Encoding UTF8

    [void]$workflowAudit.Add([pscustomobject]@{
        Workflow = $workflowName
        SourceFile = $file.Name
        NodeCount = $nodes.Count
        CredentialBindingsRemoved = $credentialCount
        EmptyWorkflowBlocker = ($nodes.Count -eq 0)
        UnauthenticatedWebhookNodes = ($unauthenticatedWebhooks -join '; ')
        ReviewWarnings = ($localEndpoints -join ' | ')
        ImportedActive = $false
    })
}

$workflowAudit | Export-Csv -LiteralPath (Join-Path $runRoot 'workflow-migration-review.csv') -NoTypeInformation -Encoding UTF8
$credentialAudit | Export-Csv -LiteralPath (Join-Path $runRoot 'credential-rebind-checklist.csv') -NoTypeInformation -Encoding UTF8

@"
n8n Cloud Migration Export
Created: $(Get-Date -Format o)
Exported workflow definitions: $($workflowFiles.Count)
Exported credentials: 0
Sanitized workflow copies: $($workflowFiles.Count)
All sanitized workflows are inactive.
Credential bindings have been removed from sanitized copies and must be recreated manually in the new n8n instance.
Review workflow-migration-review.csv and credential-rebind-checklist.csv before import.
The source-workflows-private folder may contain embedded secrets in node parameters. Keep it private and never upload it to GitHub or share it publicly.
"@ | Set-Content -LiteralPath (Join-Path $runRoot 'README.txt') -Encoding UTF8

Write-Host ''
Write-Host 'Export completed.' -ForegroundColor Green
Write-Host "Private original workflow export: $rawDir" -ForegroundColor Yellow
Write-Host "Sanitized disabled workflows: $safeDir" -ForegroundColor Green
Write-Host "Workflow review: $(Join-Path $runRoot 'workflow-migration-review.csv')"
Write-Host "Credential rebind checklist: $(Join-Path $runRoot 'credential-rebind-checklist.csv')"
Write-Host 'Do not import anything until all review warnings are resolved and target credentials are recreated.' -ForegroundColor Yellow
