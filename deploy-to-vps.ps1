# Deploy MelodIQ to VPS
# Usage: .\deploy-to-vps.ps1 "commit message"
# Kept ASCII-only on purpose: Windows PowerShell 5.1 misreads UTF-8 without BOM.

param(
    [string]$CommitMessage = "Update: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
)

$ErrorActionPreference = "Stop"

Write-Host "Deploying MelodIQ to VPS..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Git commit and push
Write-Host "Committing changes..." -ForegroundColor Yellow
git add .
git commit -m $CommitMessage
if ($LASTEXITCODE -ne 0) {
    Write-Host "No changes to commit (or commit failed), continuing with push" -ForegroundColor Yellow
}

Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Git push failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Code pushed to GitHub" -ForegroundColor Green
Write-Host ""

# Step 2: Deploy on VPS
Write-Host "Deploying on VPS..." -ForegroundColor Yellow
Write-Host ""

$VPS_HOST = "melodiq.nl"
$VPS_USER = "bojan"
$VPS_PATH = "/var/www/vhosts/melodiq.nl/melodiq"

# One single line: a multi-line string would carry CRLF to the Linux shell.
# Mirrors .github/workflows/deploy to vps - melodiq.yml: pull, rebuild, restart.
# The container CMD runs `drizzle-kit push --force` before starting the server,
# so the schema is migrated on every deploy — no separate migration step here.
$remoteCommand = "cd $VPS_PATH && (cp .env /tmp/melodiq.env.bak 2>/dev/null; true) && git pull origin main && (test -f .env || cp /tmp/melodiq.env.bak .env 2>/dev/null; true) && docker compose up -d --build && docker image prune -f && sleep 5 && docker compose ps"

ssh "$VPS_USER@$VPS_HOST" $remoteCommand

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Deployment successful! Check: https://melodiq.nl" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Deployment failed!" -ForegroundColor Red
    exit 1
}
