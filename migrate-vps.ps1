# Run database migration on VPS
# Usage: .\migrate-vps.ps1

Write-Host "🗄️  Running database migration on VPS..." -ForegroundColor Cyan
Write-Host ""

# VPS details
$VPS_HOST = "musiq.nl"
$VPS_USER = "bojan"  # Update if different
$VPS_PATH = "/var/www/vhosts/musiq.nl/musiq.nl"

$SSH_COMMANDS = @"
cd $VPS_PATH && \
echo '📋 Checking database schema...' && \
docker compose exec -T app npx drizzle-kit push && \
echo '' && \
echo '✅ Migration complete!'
"@

ssh "$VPS_USER@$VPS_HOST" $SSH_COMMANDS

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Database migration successful!" -ForegroundColor Green
    Write-Host "🌐 Test: https://musiq.nl" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "❌ Migration failed!" -ForegroundColor Red
    Write-Host "💡 Check if Docker containers are running:" -ForegroundColor Yellow
    Write-Host "   ssh $VPS_USER@$VPS_HOST 'cd $VPS_PATH && docker compose ps'" -ForegroundColor Gray
    exit 1
}
