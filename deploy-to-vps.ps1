# Deploy Musiq to VPS
# Usage: .\deploy-to-vps.ps1 "commit message"

param(
    [string]$CommitMessage = "Update: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
)

Write-Host "🚀 Deploying Musiq to VPS..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Git commit and push
Write-Host "📦 Committing changes..." -ForegroundColor Yellow
git add .
git commit -m $CommitMessage
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  No changes to commit or commit failed" -ForegroundColor Yellow
}

Write-Host "⬆️  Pushing to GitHub..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Git push failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Code pushed to GitHub" -ForegroundColor Green
Write-Host ""

# Step 2: Deploy on VPS
Write-Host "🔄 Deploying on VPS..." -ForegroundColor Yellow
Write-Host ""

# Replace with your VPS SSH details
$VPS_HOST = "musiq.nl"
$VPS_USER = "bojan"  # Update if different
$VPS_PATH = "/var/www/vhosts/musiq.nl/musiq.nl"

$SSH_COMMANDS = @"
cd $VPS_PATH && \
echo '📥 Pulling latest code...' && \
git pull origin main && \
echo '🐳 Rebuilding Docker containers...' && \
./deploy.sh && \
echo '⏳ Waiting for containers to start...' && \
sleep 10 && \
echo '🗄️  Running database migration...' && \
docker compose exec -T app npx drizzle-kit push && \
echo '✅ Deployment complete!' && \
docker compose ps
"@

ssh "$VPS_USER@$VPS_HOST" $SSH_COMMANDS

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host "🌐 Check: https://musiq.nl" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}
