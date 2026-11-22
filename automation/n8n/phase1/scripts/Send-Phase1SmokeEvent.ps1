[CmdletBinding()]
param(
  [string]$N8nBaseUrl = $(if ($env:N8N_BASE_URL) { $env:N8N_BASE_URL } else { 'http://127.0.0.1:5678' })
)
$ErrorActionPreference='Stop'
if (-not $env:SP_N8N_AGENT_TOKEN -or $env:SP_N8N_AGENT_TOKEN.Length -lt 32) { throw 'Set SP_N8N_AGENT_TOKEN in the same environment as this PowerShell session.' }
$event = @{
  eventId = "phase1-smoke-$([guid]::NewGuid().ToString('N'))"
  eventType = 'system.health.check'
  occurredAt = (Get-Date).ToUniversalTime().ToString('o')
  correlationId = "corr-phase1-$([guid]::NewGuid().ToString('N'))"
  payload = @{
    health = @{
      status = 'HEALTHY'
      uptimeSeconds = 60
      environment = 'development'
      services = @{
        database = @{ status='HEALTHY'; latencyMs=15 }
        redis = @{ status='HEALTHY'; latencyMs=2 }
        queue = @{ status='HEALTHY'; pendingJobs=0; lagSeconds=0 }
      }
    }
  }
}
$uri = $N8nBaseUrl.TrimEnd('/') + '/webhook/services-platform/events'
$result = Invoke-RestMethod -Method Post -Uri $uri -Headers @{'X-SP-Agent-Token'=$env:SP_N8N_AGENT_TOKEN} -ContentType 'application/json' -Body ($event | ConvertTo-Json -Depth 8) -TimeoutSec 20
$result | ConvertTo-Json -Depth 10
