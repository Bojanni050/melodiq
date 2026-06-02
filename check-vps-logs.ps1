# Fetch live docker logs from VPS
# Usage: .\check-vps-logs.ps1

Write-Host "📋 Fetching recent MelodIQ app logs from VPS..." -ForegroundColor Cyan
Write-Host ""

$VPS_HOST = "melodiq.nl"
$VPS_USER = "bojan"

ssh "$VPS_USER@$VPS_HOST" "cd /var/www/vhosts/melodiq.nl/melodiq.nl && docker compose logs --tail=100 app"

Write-Host ""
Write-Host "✅ Logs fetched successfully!" -ForegroundColor Green
