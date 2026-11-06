[CmdletBinding()]
param(
    [string]$InstallDir = 'C:\Program Files\Docker\Docker'
)
$ErrorActionPreference = 'Continue'
Write-Host "=== Docker Desktop diagnostic ===" -ForegroundColor Cyan
Write-Host "Target directory: $InstallDir"
if (Test-Path -LiteralPath $InstallDir -PathType Container) {
    Write-Host "[OK] Installation directory exists." -ForegroundColor Green
    Get-ChildItem -LiteralPath $InstallDir -Force | Select-Object -First 12 Name, Mode, Length | Format-Table -AutoSize
} else {
    Write-Host "[MISSING] Directory not found." -ForegroundColor Yellow
}
$desktopExe = Join-Path $InstallDir 'Docker Desktop.exe'
if (Test-Path -LiteralPath $desktopExe -PathType Leaf) {
    Write-Host "[OK] Docker Desktop.exe exists." -ForegroundColor Green
} else {
    Write-Host "[MISSING] Docker Desktop.exe not found at expected location." -ForegroundColor Yellow
}
$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$dockerExe = if ($dockerCommand) { $dockerCommand.Source } else { Join-Path $InstallDir 'resources\bin\docker.exe' }
if (Test-Path -LiteralPath $dockerExe -PathType Leaf) {
    Write-Host "[OK] Docker CLI: $dockerExe" -ForegroundColor Green
    & $dockerExe --version
    Write-Host ""
    Write-Host "--- Docker Engine / daemon ---"
    & $dockerExe version
    if ($LASTEXITCODE -ne 0) { Write-Host "[NOT READY] CLI exists but Engine/daemon is unavailable or stopped." -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "--- Docker Compose ---"
    & $dockerExe compose version
    if ($LASTEXITCODE -ne 0) { Write-Host "[NOT READY] Docker Compose plugin is unavailable." -ForegroundColor Yellow }
} else {
    Write-Host "[MISSING] Docker CLI not found in PATH or expected install directory." -ForegroundColor Red
}
Write-Host ""
Write-Host "--- WSL status ---"
$wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
if ($wsl) { & wsl.exe --status } else { Write-Host "[MISSING] wsl.exe not found." -ForegroundColor Yellow }
Write-Host ""
Write-Host "Diagnostic completed. This script does not install, update, start, stop, or modify Docker."
