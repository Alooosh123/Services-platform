$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  & "$PSScriptRoot/setup-podman.ps1"
  if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    throw "Created .env. Configure unique MySQL, Redis, JWT, encryption, admin bootstrap and backup secrets, then rerun."
  }

  $envText = Get-Content ".env" -Raw
  function Get-EnvValue([string]$key) {
    $match = [regex]::Match($envText, "(?m)^$key=(.*)$")
    if (-not $match.Success) { return $null }
    return $match.Groups[1].Value.Trim().Trim('"').Trim("'")
  }

  $required = @(
    "MYSQL_ROOT_PASSWORD",
    "MYSQL_USER",
    "MYSQL_PASSWORD",
    "MYSQL_DATABASE",
    "REDIS_PASSWORD",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "ENCRYPTION_KEY",
    "BACKUP_ENCRYPTION_KEY",
    "WEBHOOK_HMAC_SECRET",
    "SEED_SUPER_ADMIN_EMAIL",
    "SEED_SUPER_ADMIN_PASSWORD"
  )
  foreach ($key in $required) {
    $value = Get-EnvValue $key
    if ([string]::IsNullOrWhiteSpace($value) -or $value -match "REPLACE|CHANGE_ME|YOUR_") {
      throw "Missing or placeholder value for $key in .env. No containers were started."
    }
  }

  foreach ($key in @("MYSQL_ROOT_PASSWORD", "MYSQL_PASSWORD", "REDIS_PASSWORD", "JWT_SECRET", "JWT_REFRESH_SECRET", "WEBHOOK_HMAC_SECRET")) {
    if ((Get-EnvValue $key).Length -lt 32) {
      throw "$key must contain at least 32 characters. No containers were started."
    }
  }

  foreach ($key in @("ENCRYPTION_KEY", "BACKUP_ENCRYPTION_KEY")) {
    if ((Get-EnvValue $key) -notmatch '^[a-fA-F0-9]{64}$') {
      throw "$key must be a private 64-character hexadecimal key. No containers were started."
    }
  }

  if ((Get-EnvValue "SEED_SUPER_ADMIN_PASSWORD").Length -lt 20) {
    throw "SEED_SUPER_ADMIN_PASSWORD must contain at least 20 characters. No containers were started."
  }

  if ((Get-EnvValue "MYSQL_ROOT_PASSWORD") -eq (Get-EnvValue "MYSQL_PASSWORD")) {
    throw "MYSQL_ROOT_PASSWORD and MYSQL_PASSWORD must be different. No containers were started."
  }

  podman compose -f podman/compose.yml config | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Podman Compose configuration validation failed." }

  podman compose -f podman/compose.yml up -d --build
  if ($LASTEXITCODE -ne 0) { throw "Platform startup failed. Inspect Podman Compose logs." }

  podman compose -f podman/compose.yml ps
} finally {
  Pop-Location
}
