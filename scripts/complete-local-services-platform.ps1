[CmdletBinding()]
param(
    [string]$ProjectPath = 'D:\ServicesPlatform-production'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Section([string]$Title) {
    Write-Host ""
    Write-Host "========== $Title ==========" -ForegroundColor Cyan
}

function Assert-Exit([string]$Action) {
    if ($LASTEXITCODE -ne 0) {
        throw "$Action failed with exit code $LASTEXITCODE. Review .local-run logs before retrying."
    }
}

function Get-EnvValue([string]$Name, [string[]]$Lines) {
    $escaped = [regex]::Escape($Name)
    $line = $Lines | Where-Object { $_ -match "^\s*$escaped\s*=" } | Select-Object -First 1
    if (-not $line) { return $null }
    $value = ($line -replace "^\s*$escaped\s*=\s*", '').Trim()
    if ($value.Length -ge 2) {
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
    }
    return $value
}

function Assert-PortFree([int]$Port) {
    $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    if ($listeners.Count -gt 0) {
        $owners = ($listeners | Select-Object -ExpandProperty OwningProcess -Unique) -join ', '
        throw "Port $Port is already in use by process(es) $owners. Nothing was stopped."
    }
}

function Start-LocalApp([string]$ScriptName, [string]$Label, [string]$LogDirectory) {
    $stdout = Join-Path $LogDirectory "$Label.stdout.log"
    $stderr = Join-Path $LogDirectory "$Label.stderr.log"
    $commandLine = '"' + $script:NpmCommand + '" run ' + $ScriptName
    $process = Start-Process -FilePath $env:ComSpec -ArgumentList @('/d', '/c', $commandLine) -WorkingDirectory $script:ProjectPath -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Hidden -PassThru
    return [pscustomobject]@{ Name = $Label; Script = $ScriptName; ProcessId = $process.Id; Stdout = $stdout; Stderr = $stderr }
}

function Wait-Http([string]$Url, [string]$Label, [int]$TimeoutSeconds, [int]$ProcessId, [string]$StderrPath) {
    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($watch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
        if (-not $proc) {
            $stdout = $StderrPath -replace '\.stderr\.log$', '.stdout.log'
            if (Test-Path $stdout) { Get-Content -LiteralPath $stdout -Tail 50 | Write-Host -ForegroundColor Yellow }
            if (Test-Path $StderrPath) { Get-Content -LiteralPath $StderrPath -Tail 50 | Write-Host -ForegroundColor Yellow }
            throw "$Label process stopped. See $StderrPath"
        }
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                Write-Host "$Label responded: HTTP $($response.StatusCode)" -ForegroundColor Green
                return
            }
        } catch { }
        Start-Sleep -Seconds 3
    }
    $stdout = $StderrPath -replace '\.stderr\.log$', '.stdout.log'
    if (Test-Path $stdout) { Get-Content -LiteralPath $stdout -Tail 50 | Write-Host -ForegroundColor Yellow }
    if (Test-Path $StderrPath) { Get-Content -LiteralPath $StderrPath -Tail 50 | Write-Host -ForegroundColor Yellow }
    throw "$Label did not become available within $TimeoutSeconds seconds. See $StderrPath"
}

Write-Section 'PROJECT AND LOCAL-ONLY SAFETY CHECKS'
$script:ProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path
Set-Location -LiteralPath $script:ProjectPath

$required = @('package.json', 'package-lock.json', '.env', 'docker/docker-compose.yml', 'packages/database/prisma/schema.prisma')
foreach ($item in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $script:ProjectPath $item) -PathType Leaf)) {
        throw "Required project file is missing: $item"
    }
}

$envLines = Get-Content -LiteralPath (Join-Path $script:ProjectPath '.env')
$dbValue = Get-EnvValue 'DATABASE_URL' $envLines
if ([string]::IsNullOrWhiteSpace($dbValue)) { throw 'DATABASE_URL is missing. .env was not changed.' }

$nodeEnv = Get-EnvValue 'NODE_ENV' $envLines
if ($nodeEnv -eq 'production' -or $env:NODE_ENV -eq 'production') {
    throw 'Production mode detected. This script refuses to run migrations outside local development.'
}
try { $dbUri = [System.Uri]::new($dbValue) } catch { throw 'DATABASE_URL is not a valid URL; credentials were not displayed.' }
if ($dbUri.Scheme -notin @('postgresql', 'postgres')) { throw 'DATABASE_URL must be PostgreSQL.' }
if ($dbUri.Host -notin @('localhost', '127.0.0.1', '::1')) { throw 'DATABASE_URL is not loopback. Refusing to migrate a remote database.' }
$dbName = [System.Uri]::UnescapeDataString($dbUri.AbsolutePath.TrimStart('/').Split('?')[0])
if ([string]::IsNullOrWhiteSpace($dbName)) { throw 'DATABASE_URL has no database name.' }
$env:DATABASE_URL = $dbValue
$env:PORT = '4000'
$env:API_PREFIX = 'api'

$redisValue = Get-EnvValue 'REDIS_URL' $envLines
if ([string]::IsNullOrWhiteSpace($redisValue) -or $redisValue -match '://redis:') { $redisValue = 'redis://127.0.0.1:6379' }
try { $redisUri = [System.Uri]::new($redisValue) } catch { throw 'REDIS_URL is invalid; value was not displayed.' }
if ($redisUri.Host -notin @('localhost', '127.0.0.1', '::1')) { throw 'REDIS_URL is not loopback. Refusing to use external Redis.' }
$env:REDIS_URL = $redisValue

$logDirectory = Join-Path $script:ProjectPath '.local-run'
$backupDirectory = Join-Path $logDirectory 'backups'
New-Item -ItemType Directory -Force -Path $logDirectory, $backupDirectory | Out-Null
$node = & node --version
Assert-Exit 'Node version check'
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) { throw 'npm.cmd was not found in PATH.' }
$script:NpmCommand = $npm.Source
Write-Host "Project: $script:ProjectPath"
Write-Host "Node.js: $node"
Write-Host "PostgreSQL target: $($dbUri.Host):$($dbUri.Port)/$dbName (credentials hidden)"
Write-Host "Redis target: $($redisUri.Host):$($redisUri.Port) (credentials hidden)"

Write-Section 'START AND VERIFY LOCAL DATABASE SERVICES'
$compose = @('compose', '--env-file', '.env', '-f', 'docker/docker-compose.yml')
& docker @compose up -d postgres redis
Assert-Exit 'Start PostgreSQL and Redis'
& docker @compose ps
Assert-Exit 'Compose status'

foreach ($name in @('topup_postgres', 'topup_redis')) {
    $health = 'unknown'
    for ($i = 1; $i -le 18; $i++) {
        $health = (& docker inspect --format '{{.State.Health.Status}}' $name | Out-String).Trim()
        Assert-Exit "Inspect $name"
        if ($health -eq 'healthy') { break }
        if ($health -eq 'unhealthy') { throw "$name is unhealthy. No migration was run." }
        Start-Sleep -Seconds 5
    }
    if ($health -ne 'healthy') { throw "$name did not become healthy. No migration was run." }
    Write-Host "$name health: $health" -ForegroundColor Green
}

$pgInspect = & docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' topup_postgres
Assert-Exit 'Read PostgreSQL configuration'
$pgUser = 'postgres'
$pgDb = 'digital_topup_db'
foreach ($entry in $pgInspect) {
    if ($entry -match '^POSTGRES_USER=(.*)$') { $pgUser = $Matches[1] }
    if ($entry -match '^POSTGRES_DB=(.*)$') { $pgDb = $Matches[1] }
}
if ($dbName -ne $pgDb) { throw "DATABASE_URL database does not match container database. No migration was run." }
$pgPorts = @(& docker port topup_postgres 5432/tcp)
Assert-Exit 'Read PostgreSQL host port'
if (-not ($pgPorts | Where-Object { $_ -match (':' + [regex]::Escape([string]$dbUri.Port) + '$') })) {
    throw "DATABASE_URL port $($dbUri.Port) is not published by topup_postgres. No migration was run."
}
$redisPorts = @(& docker port topup_redis 6379/tcp)
Assert-Exit 'Read Redis host port'
if (-not ($redisPorts | Where-Object { $_ -match (':' + [regex]::Escape([string]$redisUri.Port) + '$') })) {
    throw 'REDIS_URL port is not published by topup_redis.'
}
$sql = & docker exec topup_postgres psql -v ON_ERROR_STOP=1 -U $pgUser -d $pgDb -Atc 'SELECT current_database() || ''|'' || current_user;'
Assert-Exit 'PostgreSQL SQL check'
Write-Host "PostgreSQL SQL: $sql" -ForegroundColor Green
$ping = & docker exec topup_redis redis-cli ping
Assert-Exit 'Redis PING'
if (($ping | Out-String).Trim() -ne 'PONG') { throw 'Redis did not return PONG.' }
Write-Host 'Redis: PONG' -ForegroundColor Green

Write-Section 'INSTALL DEPENDENCIES AND GENERATE PRISMA'
& $script:NpmCommand ci --no-audit --no-fund
Assert-Exit 'npm ci'
& $script:NpmCommand run db:generate
Assert-Exit 'Prisma Client generation'
$prisma = Join-Path $script:ProjectPath 'node_modules/.bin/prisma.cmd'
if (-not (Test-Path $prisma)) { throw 'Prisma CLI was not found after dependency installation.' }
& $prisma validate --schema='packages/database/prisma/schema.prisma'
Assert-Exit 'Prisma schema validation'

Write-Section 'CREATE AND VERIFY PRE-MIGRATION BACKUP'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$insideBackup = "/tmp/services-platform-pre-migrate-$stamp.sql"
$backup = Join-Path $backupDirectory "pre-migrate-$stamp.sql"
& docker exec topup_postgres pg_dump -U $pgUser -d $pgDb -f $insideBackup
Assert-Exit 'pg_dump'
& docker cp "topup_postgres:$insideBackup" $backup
Assert-Exit 'Copy database backup'
if (-not (Test-Path $backup) -or (Get-Item $backup).Length -lt 100) { throw 'Backup missing or too small. Migrations were not run.' }
$backupHash = (Get-FileHash $backup -Algorithm SHA256).Hash
Write-Host "Backup: $backup"
Write-Host "Backup SHA256: $backupHash"
& docker exec topup_postgres rm -f $insideBackup | Out-Null

Write-Section 'APPLY LOCAL MIGRATIONS'
& $script:NpmCommand run db:migrate:deploy
Assert-Exit 'Prisma migrate deploy'
& $prisma migrate status --schema='packages/database/prisma/schema.prisma'
Assert-Exit 'Prisma migration status'

Write-Section 'BUILD MONOREPO'
# Next.js build must not inherit NODE_ENV=development from this runner.
# Next.js sets production mode internally for "next build".
Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
& $script:NpmCommand run build
Assert-Exit 'Monorepo build'

Write-Section 'START BACKEND AND TEST CUSTOMER AUTH'
# Runtime development servers must inherit development mode only after builds finish.
$env:NODE_ENV = 'development'
foreach ($port in @(4000, 3000, 3001, 3002)) { Assert-PortFree $port }
$backend = Start-LocalApp 'dev:backend' 'backend' $logDirectory
Wait-Http 'http://localhost:4000/api/health/ready' 'Backend readiness' 150 $backend.ProcessId $backend.Stderr

$email = 'local-smoke-' + [guid]::NewGuid().ToString('N').Substring(0, 16) + '@example.com'
$password = [guid]::NewGuid().ToString('N') + 'Aa1!'
$registerBody = @{ fullName = 'Local Smoke Test Customer'; email = $email; password = $password } | ConvertTo-Json
try {
    $registration = Invoke-RestMethod -Uri 'http://localhost:4000/api/auth/register' -Method Post -ContentType 'application/json' -Body $registerBody -TimeoutSec 30
} catch { throw "Customer registration failed: $($_.Exception.Message). Backend log: $($backend.Stderr)" }
if (-not $registration.tokens.accessToken) { throw 'Registration returned no access token.' }
$loginBody = @{ identifier = $email; password = $password } | ConvertTo-Json
try {
    $login = Invoke-RestMethod -Uri 'http://localhost:4000/api/auth/login' -Method Post -ContentType 'application/json' -Body $loginBody -TimeoutSec 30
} catch { throw "Customer login failed: $($_.Exception.Message). Backend log: $($backend.Stderr)" }
if (-not $login.tokens.accessToken) { throw 'Login returned no access token.' }
Write-Host "Customer registration: PASS ($email)"
Write-Host 'Customer login: PASS (token not displayed)' -ForegroundColor Green

Write-Section 'START WEB APPS'
$apps = @(
    @{ Port = 3000; Script = 'dev:customer'; Name = 'customer-web' },
    @{ Port = 3001; Script = 'dev:admin'; Name = 'admin-web' },
    @{ Port = 3002; Script = 'dev:saas'; Name = 'saas-web' }
)
$started = @($backend)
foreach ($app in $apps) {
    $info = Start-LocalApp $app.Script $app.Name $logDirectory
    $started += $info
    Wait-Http "http://localhost:$($app.Port)" $app.Name 150 $info.ProcessId $info.Stderr
}
$manifest = Join-Path $logDirectory 'processes.json'
$started | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifest -Encoding UTF8

Write-Section 'LOCAL ENVIRONMENT RESULT'
Write-Host 'PostgreSQL: healthy'
Write-Host 'Redis: healthy'
Write-Host 'Prisma migrations: applied and checked'
Write-Host 'Monorepo build: passed'
Write-Host 'Customer registration/login: passed'
Write-Host 'Customer Web: http://localhost:3000'
Write-Host 'Admin Web: http://localhost:3001'
Write-Host 'SaaS Web: http://localhost:3002'
Write-Host 'Backend: http://localhost:4000/api'
Write-Host 'Swagger: http://localhost:4000/api/docs'
Write-Host "Logs: $logDirectory"
Write-Host "Backup: $backup"
Write-Host "Process list: $manifest"
Write-Host 'No seed reset, production migration, wallet activation, provider activation or real payment was performed.' -ForegroundColor Yellow
