$ErrorActionPreference = "Stop"
if (-not (Get-Command podman -ErrorAction SilentlyContinue)) { throw "Podman CLI was not found. Install Podman Desktop for Windows, then reopen PowerShell." }
$machinesJson = podman machine list --format json
if ($LASTEXITCODE -ne 0) { throw "Unable to query Podman Machine." }
$machines = @()
if ($machinesJson) { $machines = @($machinesJson | ConvertFrom-Json) }
if ($machines.Count -eq 0) {
  podman machine init --cpus 4 --memory 4096 --disk-size 60
  if ($LASTEXITCODE -ne 0) { throw "Podman Machine initialization failed." }
  podman machine start
  if ($LASTEXITCODE -ne 0) { throw "Podman Machine could not be started." }
} else {
  $running = $false
  foreach ($machine in $machines) { if ($machine.Running -eq $true) { $running = $true } }
  if (-not $running) { podman machine start; if ($LASTEXITCODE -ne 0) { throw "Podman Machine could not be started." } }
}
podman info | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Podman engine is not responding." }
podman compose version
if ($LASTEXITCODE -ne 0) { throw "Install/enable the Compose provider in Podman Desktop Settings > Resources, then rerun." }
Write-Host "Podman Engine and Compose are ready."
