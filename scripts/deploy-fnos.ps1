# Build MoviePilot fnos payload locally, then remote fnpack --nosign on fnOS.
# Usage:
#   .\scripts\deploy-fnos.ps1
#   .\scripts\deploy-fnos.ps1 -DownloadFpk
#   .\scripts\deploy-fnos.ps1 -SkipVersionBump

param(
  [switch]$DownloadFpk,
  [switch]$SkipVersionBump
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Workspace = Split-Path -Parent $Root
$UseNode = Join-Path $Workspace "tool\use-node.ps1"
. $UseNode
Set-Location $Root

if ($SkipVersionBump) { $env:SKIP_VERSION_BUMP = "1" } else { Remove-Item Env:SKIP_VERSION_BUMP -ErrorAction SilentlyContinue }
if ($DownloadFpk) { $env:DOWNLOAD_FPK = "1" } else { Remove-Item Env:DOWNLOAD_FPK -ErrorAction SilentlyContinue }

Write-Host "==> build payload (no local fnpack)"
node .\scripts\build-payload.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$env:LOCAL_PACK = Join-Path $Root "fnos"
$env:LOCAL_FPK_OUT = Join-Path $Root "moviepilot.fpk"
$env:FPK_PACK_NAME = "fnos"

Write-Host "==> deploy + remote fnpack on fnOS"
Set-Location (Join-Path $Workspace "tool\ssh-helper")
if (-not (Test-Path ".\node_modules\ssh2")) {
  npm install --omit=dev
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
node .\deploy-fpk-moviepilot.js
exit $LASTEXITCODE
