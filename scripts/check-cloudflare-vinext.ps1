# Read-only compatibility scan for the three existing Next.js apps before Cloudflare migration.
# This script does not install dependencies into the repository or modify app configuration.
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$apps = @(
    'apps/web-customer',
    'apps/web-admin',
    'apps/web-saas'
)
$reportDir = Join-Path $repoRoot 'artifacts\cloudflare-vinext-check'
New-Item -ItemType Directory -Path $reportDir -Force | Out-Null

$failures = @()
foreach ($app in $apps) {
    $appPath = Join-Path $repoRoot $app
    if (-not (Test-Path (Join-Path $appPath 'package.json'))) {
        $failures += "$app (package.json missing)"
        continue
    }

    $name = $app.Replace('/', '-')
    $logPath = Join-Path $reportDir "$name.log"
    Write-Host "========== vinext compatibility: $app ==========" -ForegroundColor Cyan
    Push-Location $appPath
    try {
        & npx.cmd --yes vinext check 2>&1 | Tee-Object -FilePath $logPath
        if ($LASTEXITCODE -ne 0) {
            $failures += $app
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host "Reports saved to: $reportDir" -ForegroundColor Green
if ($failures.Count -gt 0) {
    Write-Host "Compatibility scan needs attention for:" -ForegroundColor Yellow
    $failures | ForEach-Object { Write-Host " - $_" }
    exit 1
}

Write-Host 'All three scans completed. Review every report; a successful scan is not production approval.' -ForegroundColor Green
