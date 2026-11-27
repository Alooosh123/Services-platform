[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ApiBaseUrl,
    [Parameter(Mandatory = $true)]
    [string]$CustomerUrl,
    [Parameter(Mandatory = $true)]
    [string]$AdminUrl,
    [Parameter(Mandatory = $true)]
    [string]$SaasUrl,
    [string]$N8nBaseUrl,
    [ValidateRange(3, 120)]
    [int]$TimeoutSec = 20,
    [string]$ReportDirectory = (Join-Path $PSScriptRoot '..\artifacts\staging-smoke-tests')
)

$ErrorActionPreference = 'Stop'
$results = New-Object System.Collections.Generic.List[object]

function ConvertTo-ValidatedHttpsBaseUrl {
    param([string]$Value, [string]$Name)
    $uri = $null
    if (-not [Uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$uri)) {
        throw "$Name must be an absolute HTTPS URL."
    }
    if ($uri.Scheme -ne 'https') {
        throw "$Name must use HTTPS."
    }
    if ($uri.Host -in @('localhost', '127.0.0.1') -or $uri.IsLoopback) {
        throw "$Name cannot point to localhost or loopback."
    }
    return $uri.AbsoluteUri.TrimEnd('/')
}

function Add-ProbeResult {
    param([string]$Name, [bool]$Passed, [string]$Detail)
    [void]$script:results.Add([pscustomobject]@{
        Name = $Name
        Passed = $Passed
        Detail = $Detail
        CheckedAtUtc = [DateTime]::UtcNow.ToString('o')
    })
    $color = if ($Passed) { 'Green' } else { 'Red' }
    $status = if ($Passed) { 'PASS' } else { 'FAIL' }
    Write-Host "[$status] $Name - $Detail" -ForegroundColor $color
}

function Invoke-HttpProbe {
    param(
        [string]$Name,
        [string]$Uri,
        [bool]$ExpectReadyJson = $false,
        [bool]$ExpectLiveJson = $false
    )
    try {
        $response = Invoke-WebRequest -Uri $Uri -Method Get -UseBasicParsing -TimeoutSec $TimeoutSec
        $passed = [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 300
        $detail = "HTTP $([int]$response.StatusCode)"
        if ($passed -and ($ExpectReadyJson -or $ExpectLiveJson)) {
            $payload = $response.Content | ConvertFrom-Json
            if ($ExpectReadyJson) {
                $passed = ($payload.ready -eq $true)
                $detail += "; ready=$($payload.ready)"
            }
            if ($ExpectLiveJson) {
                $passed = ($payload.status -eq 'UP')
                $detail += "; status=$($payload.status)"
            }
        }
        Add-ProbeResult -Name $Name -Passed $passed -Detail $detail
    }
    catch {
        $statusCode = ''
        try {
            if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
                $statusCode = " HTTP $([int]$_.Exception.Response.StatusCode)"
            }
        } catch {}
        Add-ProbeResult -Name $Name -Passed $false -Detail ("Request failed." + $statusCode)
    }
}

function Test-CorsOrigin {
    param([string]$ApiUrl, [string]$Origin)
    $name = "CORS preflight: $Origin"
    try {
        $headers = @{
            Origin = $Origin
            'Access-Control-Request-Method' = 'GET'
            'Access-Control-Request-Headers' = 'authorization,content-type'
        }
        $response = Invoke-WebRequest -Uri "$ApiUrl/api/health/live" -Method Options -Headers $headers -UseBasicParsing -TimeoutSec $TimeoutSec
        $allowOrigin = [string]$response.Headers['Access-Control-Allow-Origin']
        $allowCredentials = [string]$response.Headers['Access-Control-Allow-Credentials']
        $passed = ($allowOrigin -eq $Origin -and $allowCredentials -eq 'true')
        $detail = "HTTP $([int]$response.StatusCode); exact origin match=$($allowOrigin -eq $Origin); credentials=$allowCredentials"
        Add-ProbeResult -Name $name -Passed $passed -Detail $detail
    }
    catch {
        Add-ProbeResult -Name $name -Passed $false -Detail 'CORS preflight request failed.'
    }
}

try {
    $api = ConvertTo-ValidatedHttpsBaseUrl -Value $ApiBaseUrl -Name 'ApiBaseUrl'
    $customer = ConvertTo-ValidatedHttpsBaseUrl -Value $CustomerUrl -Name 'CustomerUrl'
    $admin = ConvertTo-ValidatedHttpsBaseUrl -Value $AdminUrl -Name 'AdminUrl'
    $saas = ConvertTo-ValidatedHttpsBaseUrl -Value $SaasUrl -Name 'SaasUrl'

    Write-Host ''
    Write-Host '========== Services-platform Staging Smoke Tests ==========' -ForegroundColor Cyan
    Write-Host 'Read-only HTTP checks only. No login, order, wallet or financial mutation is performed.' -ForegroundColor Yellow

    Invoke-HttpProbe -Name 'Backend liveness' -Uri "$api/api/health/live" -ExpectLiveJson $true
    Invoke-HttpProbe -Name 'Backend readiness (PostgreSQL + Redis)' -Uri "$api/api/health/ready" -ExpectReadyJson $true
    Invoke-HttpProbe -Name 'Customer web root' -Uri "$customer/"
    Invoke-HttpProbe -Name 'Admin web root' -Uri "$admin/"
    Invoke-HttpProbe -Name 'SaaS web root' -Uri "$saas/"

    Test-CorsOrigin -ApiUrl $api -Origin $customer
    Test-CorsOrigin -ApiUrl $api -Origin $admin
    Test-CorsOrigin -ApiUrl $api -Origin $saas

    if (-not [string]::IsNullOrWhiteSpace($N8nBaseUrl)) {
        $n8n = ConvertTo-ValidatedHttpsBaseUrl -Value $N8nBaseUrl -Name 'N8nBaseUrl'
        Invoke-HttpProbe -Name 'n8n health endpoint (only if public probe is permitted)' -Uri "$n8n/healthz"
    }
    else {
        Add-ProbeResult -Name 'n8n health endpoint' -Passed $true -Detail 'Not probed publicly; verify using Northflank internal health checks or an authenticated admin session.'
    }
}
catch {
    Add-ProbeResult -Name 'Smoke test configuration' -Passed $false -Detail $_.Exception.Message
}

New-Item -ItemType Directory -Path $ReportDirectory -Force | Out-Null
$reportPath = Join-Path $ReportDirectory ("staging-smoke-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + ".csv")
$results | Export-Csv -LiteralPath $reportPath -NoTypeInformation -Encoding UTF8

$failed = @($results | Where-Object { -not $_.Passed }).Count
$passed = @($results | Where-Object { $_.Passed }).Count

Write-Host ''
Write-Host '========== Result ==========' -ForegroundColor Cyan
Write-Host "Passed: $passed"
Write-Host "Failed: $failed"
Write-Host "Report: $reportPath"

if ($failed -gt 0) {
    exit 1
}
