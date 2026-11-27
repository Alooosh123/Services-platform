[CmdletBinding()]
param(
    [string]$OutputRoot = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'ServicesPlatform-n8n-cloud-migration')
)

$ErrorActionPreference = 'Stop'

# This utility exports workflow definitions only; n8n Credentials are never exported.
# All output copies are review-only and inactive. They are NOT approved for import.
$n8nCommand = Get-Command 'n8n.cmd' -ErrorAction SilentlyContinue
if (-not $n8nCommand) {
    $n8nCommand = Get-Command 'n8n' -ErrorAction SilentlyContinue
}
if (-not $n8nCommand) {
    throw 'n8n CLI was not found in PATH. Run this script in the Windows account that owns the local n8n installation.'
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$runRoot = Join-Path $OutputRoot $stamp
$rawDir = Join-Path $runRoot 'source-workflows-private'
$reviewDir = Join-Path $runRoot 'review-only-workflows'
New-Item -ItemType Directory -Path $rawDir -Force | Out-Null
New-Item -ItemType Directory -Path $reviewDir -Force | Out-Null

Write-Host "n8n executable: $($n8nCommand.Source)" -ForegroundColor Cyan
& $n8nCommand.Source 'export:workflow' '--all' '--separate' "--output=$rawDir"
if ($LASTEXITCODE -ne 0) {
    throw "n8n export:workflow failed with exit code $LASTEXITCODE"
}

$workflowFiles = @(Get-ChildItem -LiteralPath $rawDir -Filter '*.json' -File)
if ($workflowFiles.Count -eq 0) {
    throw 'No workflow JSON files were exported. Nothing has been prepared.'
}

$credentialAudit = New-Object System.Collections.Generic.List[object]
$workflowAudit = New-Object System.Collections.Generic.List[object]
$environmentAudit = New-Object System.Collections.Generic.List[object]
$secretKeyPattern = '(?i)^(password|passwd|secret|clientsecret|accesstoken|refreshtoken|authorization|api[_-]?key|token|privatekey|private_key)$'
$headerNamePattern = '(?i)(authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|token)'
$envReferencePattern = '(?i)\$(?:env|vars)\.([A-Za-z_][A-Za-z0-9_]*)|process\.env\.([A-Za-z_][A-Za-z0-9_]*)'
$localReferencePattern = '(?i)localhost|127\.0\.0\.1|host\.docker\.internal|ollama|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}'
$removedMarker = '[REMOVED - RECREATE AS N8N CREDENTIAL]'

function Get-StringLeaves {
    param(
        [object]$Value,
        [string]$Path
    )

    if ($null -eq $Value) { return }

    if ($Value -is [string]) {
        [pscustomobject]@{ Path = $Path; Value = $Value }
        return
    }

    if ($Value -is [System.Array]) {
        for ($i = 0; $i -lt $Value.Count; $i++) {
            Get-StringLeaves -Value $Value[$i] -Path "$Path[$i]"
        }
        return
    }

    if ($Value -is [pscustomobject]) {
        foreach ($property in $Value.PSObject.Properties) {
            Get-StringLeaves -Value $property.Value -Path "$Path.$($property.Name)"
        }
    }
}

function Protect-WorkflowObject {
    param([object]$Value)

    if ($null -eq $Value) { return }

    if ($Value -is [System.Array]) {
        foreach ($item in $Value) {
            Protect-WorkflowObject -Value $item
        }
        return
    }

    if ($Value -is [pscustomobject]) {
        $properties = @($Value.PSObject.Properties)
        $nameProperty = $Value.PSObject.Properties['name']
        $valueProperty = $Value.PSObject.Properties['value']

        if ($nameProperty -and $valueProperty -and [string]$nameProperty.Value -match $headerNamePattern) {
            try { $valueProperty.Value = $removedMarker } catch {}
        }

        foreach ($property in $properties) {
            if ($property.Name -match $secretKeyPattern) {
                if ($property.MemberType -eq 'NoteProperty' -or $property.MemberType -eq 'Property') {
                    try { $property.Value = $removedMarker } catch {}
                }
            }
            else {
                Protect-WorkflowObject -Value $property.Value
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
    $unboundHeaderWebhooks = New-Object System.Collections.Generic.List[string]
    $localEndpoints = New-Object System.Collections.Generic.List[string]
    $envReferences = New-Object System.Collections.Generic.List[string]
    $codeEnvReferences = New-Object System.Collections.Generic.List[string]
    $hasPotentialInlineSecret = $false

    if ($nodes.Count -eq 0) {
        [void]$workflowAudit.Add([pscustomobject]@{
            Workflow = $workflowName
            SourceFile = $file.Name
            NodeCount = 0
            CredentialBindingsRemoved = 0
            InboundWebhookNodes = 0
            UnauthenticatedWebhookNodes = ''
            HeaderAuthMissingCredentialBinding = ''
            LocalEndpointReview = ''
            EnvironmentReferences = ''
            CodeNodeEnvironmentReferences = ''
            PotentialInlineSecret = $false
            ImportedActive = $false
            ImportReadiness = 'SKIPPED_EMPTY_WORKFLOW'
        })
        continue
    }

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

        # Only the inbound Webhook trigger is an authentication boundary.
        # Respond to Webhook is a response node and must not be counted here.
        if ([string]$node.type -eq 'n8n-nodes-base.webhook') {
            $auth = [string]$node.parameters.authentication
            if ([string]::IsNullOrWhiteSpace($auth) -or $auth -eq 'none') {
                [void]$unauthenticatedWebhooks.Add([string]$node.name)
            }
            elseif ($auth -eq 'headerAuth') {
                $headerCredential = $node.credentials
                # Credentials are deliberately removed above; use the original
                # export audit below to check binding state before removal.
            }
        }

        $nodeJson = $node.parameters | ConvertTo-Json -Depth 100 -Compress
        foreach ($match in [regex]::Matches($nodeJson, $envReferencePattern)) {
            $variable = if ($match.Groups[1].Success) { $match.Groups[1].Value } else { $match.Groups[2].Value }
            [void]$envReferences.Add($variable)
            if ([string]$node.type -eq 'n8n-nodes-base.code') {
                [void]$codeEnvReferences.Add($variable)
            }
            $isSensitive = $variable -match '(?i)(TOKEN|API[_-]?KEY|BOT_TOKEN|PASSWORD|SECRET|PRIVATE)'
            [void]$environmentAudit.Add([pscustomobject]@{
                Workflow = $workflowName
                Node = [string]$node.name
                NodeType = [string]$node.type
                Variable = $variable
                SensitiveName = [bool]$isSensitive
                Action = if ($isSensitive) { 'Move to n8n Credential or service secret; do not expose to Code node' } else { 'Review and replace with non-secret workflow configuration or URL' }
            })
        }

        if ($nodeJson -match $localReferencePattern) {
            [void]$localEndpoints.Add([string]$node.name)
        }
    }

    # The original webhook bindings were captured before credential removal
    # by credentialAudit. A headerAuth trigger without a matching credential
    # record for that same workflow/node is a missing binding.
    foreach ($node in $nodes) {
        if ([string]$node.type -eq 'n8n-nodes-base.webhook' -and [string]$node.parameters.authentication -eq 'headerAuth') {
            $hasBinding = @($credentialAudit | Where-Object {
                $_.Workflow -eq $workflowName -and
                $_.Node -eq [string]$node.name -and
                $_.CredentialType -eq 'httpHeaderAuth'
            }).Count -gt 0

            if (-not $hasBinding) {
                [void]$unboundHeaderWebhooks.Add([string]$node.name)
            }
        }
    }

    if ($workflow.PSObject.Properties['active']) {
        $workflow.active = $false
    }
    else {
        $workflow | Add-Member -NotePropertyName active -NotePropertyValue $false
    }

    Protect-WorkflowObject -Value $workflow
    $serialized = $workflow | ConvertTo-Json -Depth 100

    # Heuristic only: a match blocks import for manual review; it is not proof
    # that a secret exists or that the workflow is safe when no match is found.
    if ($serialized -match '(?i)Bearer\s+[A-Za-z0-9._\-]{16,}|(?:sk_live_|sk_test_|ghp_|gho_|xox[baprs]-)[A-Za-z0-9_\-]{12,}') {
        $hasPotentialInlineSecret = $true
    }

    $blockers = New-Object System.Collections.Generic.List[string]
    if ($credentialCount -gt 0) { [void]$blockers.Add('CREDENTIALS_REMOVED_REBIND_REQUIRED') }
    if ($unauthenticatedWebhooks.Count -gt 0) { [void]$blockers.Add('INBOUND_WEBHOOK_AUTH_REQUIRED') }
    if ($unboundHeaderWebhooks.Count -gt 0) { [void]$blockers.Add('HEADER_AUTH_CREDENTIAL_BINDING_REQUIRED') }
    if ($localEndpoints.Count -gt 0) { [void]$blockers.Add('LOCAL_ENDPOINT_REWRITE_REQUIRED') }
    if ($envReferences.Count -gt 0) { [void]$blockers.Add('ENVIRONMENT_REFERENCE_REVIEW_REQUIRED') }
    if ($hasPotentialInlineSecret) { [void]$blockers.Add('POTENTIAL_INLINE_SECRET_REVIEW_REQUIRED') }

    $safePath = Join-Path $reviewDir $file.Name
    Set-Content -LiteralPath $safePath -Value $serialized -Encoding UTF8

    [void]$workflowAudit.Add([pscustomobject]@{
        Workflow = $workflowName
        SourceFile = $file.Name
        NodeCount = $nodes.Count
        CredentialBindingsRemoved = $credentialCount
        InboundWebhookNodes = @($nodes | Where-Object { [string]$_.type -eq 'n8n-nodes-base.webhook' }).Count
        UnauthenticatedWebhookNodes = ($unauthenticatedWebhooks -join '; ')
        HeaderAuthMissingCredentialBinding = ($unboundHeaderWebhooks -join '; ')
        LocalEndpointReview = (@($localEndpoints | Sort-Object -Unique) -join '; ')
        EnvironmentReferences = (@($envReferences | Sort-Object -Unique) -join '; ')
        CodeNodeEnvironmentReferences = (@($codeEnvReferences | Sort-Object -Unique) -join '; ')
        PotentialInlineSecret = $hasPotentialInlineSecret
        ImportedActive = $false
        ImportReadiness = if ($blockers.Count -gt 0) { $blockers -join ';' } else { 'MANUAL_REVIEW_AND_TARGET_VALIDATION_REQUIRED' }
    })
}

$workflowAudit | Export-Csv -LiteralPath (Join-Path $runRoot 'workflow-migration-review.csv') -NoTypeInformation -Encoding UTF8
$credentialAudit | Export-Csv -LiteralPath (Join-Path $runRoot 'credential-rebind-checklist.csv') -NoTypeInformation -Encoding UTF8
$environmentAudit | Sort-Object Workflow, Node, Variable -Unique |
    Export-Csv -LiteralPath (Join-Path $runRoot 'environment-reference-audit.csv') -NoTypeInformation -Encoding UTF8

@"
n8n Cloud Migration Export - REVIEW ONLY
Created: $(Get-Date -Format o)
Local n8n version: $(& $n8nCommand.Source --version)
Exported workflow definitions: $($workflowFiles.Count)
Review-only non-empty workflow copies: $(($workflowAudit | Where-Object { $_.NodeCount -gt 0 }).Count)
Empty workflows skipped: $(($workflowAudit | Where-Object { $_.NodeCount -eq 0 }).Count)
Exported credentials: 0
All review-only workflow copies are inactive.
Credential bindings are removed from copies and must be recreated manually in the target n8n instance.
Only n8n-nodes-base.webhook is counted as an inbound webhook. Respond to Webhook is not an inbound trigger.
Review workflow-migration-review.csv, credential-rebind-checklist.csv and environment-reference-audit.csv.
These copies are not approved for import until all ImportReadiness blockers are resolved and target tests pass.
The source-workflows-private folder may contain secrets in node parameters. Keep it private; never upload it to GitHub or share it.
"@ | Set-Content -LiteralPath (Join-Path $runRoot 'README.txt') -Encoding UTF8

Write-Host ''
Write-Host 'Export completed. All generated workflow copies are INACTIVE and REVIEW-ONLY.' -ForegroundColor Green
Write-Host "Private original workflow export: $rawDir" -ForegroundColor Yellow
Write-Host "Review-only disabled workflows: $reviewDir" -ForegroundColor Green
Write-Host "Workflow review: $(Join-Path $runRoot 'workflow-migration-review.csv')"
Write-Host "Credential rebind checklist: $(Join-Path $runRoot 'credential-rebind-checklist.csv')"
Write-Host "Environment reference audit: $(Join-Path $runRoot 'environment-reference-audit.csv')"
Write-Host 'Do not import until every blocker is resolved and target credentials are recreated.' -ForegroundColor Yellow
