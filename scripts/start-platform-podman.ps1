$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  & "$PSScriptRoot/setup-podman.ps1"
  if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env"; throw "Created .env. Configure unique MySQL, Redis, JWT, admin bootstrap and backup secrets, then rerun." }
  $envText = Get-Content ".env" -Raw
  $required = @("MYSQL_ROOT_PASSWORD","MYSQL_USER","MYSQL_PASSWORD","MYSQL_DATABASE","REDIS_PASSWORD","JWT_SECRET","JWT_REFRESH_SECRET","SEED_SUPER_ADMIN_EMAIL","SEED_SUPER_ADMIN_PASSWORD","BACKUP_ENCRYPTION_KEY")
  foreach ($key in $required) {
    $match = [regex]::Match($envText, "(?m)^$key=(.*)$")
    if (-not $match.Success -or [string]::IsNullOrWhiteSpace($match.Groups[1].Value) -or $match.Groups[1].Value -match "REPLACE|CHANGE_ME|YOUR_") { throw "Missing or placeholder value for $key in .env. No containers were started." }
  }
  podman compose -f podman/compose.yml config | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Podman Compose configuration validation failed." }
  podman compose -f docker/docker-compose.yml up -d --build
  if ($LASTEXITCODE -ne 0) { throw "Platform startup failed. Inspect Podman Compose logs." }
  podman compose -f docker/docker-compose.yml ps
} finally { Pop-Location }
