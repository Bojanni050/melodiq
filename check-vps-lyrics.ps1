# Check VPS Lyrics and Timestamps Status
# Usage: .\check-vps-lyrics.ps1

Write-Host "🔍 Querying MelodIQ Production DB on VPS..." -ForegroundColor Cyan
Write-Host ""

$VPS_HOST = "melodiq.nl"
$VPS_USER = "bojan"

$SQL_QUERY = @"
SELECT 
  id, 
  LEFT(title, 25) as title, 
  status, 
  instrumental,
  CASE WHEN lyrics IS NOT NULL THEN 'YES' ELSE 'NO' END as has_lyrics,
  CASE WHEN lyrics_timestamps IS NOT NULL THEN 'YES' ELSE 'NO' END as has_tcl,
  LEFT(lyrics_timestamps, 60) as tcl_excerpt,
  created_at
FROM tracks 
ORDER BY created_at DESC 
LIMIT 10;
"@

$SSH_COMMAND = "docker compose exec -T db psql -U melodiq -d melodiq -c `"$SQL_QUERY`""

ssh "$VPS_USER@$VPS_HOST" "cd /var/www/vhosts/melodiq.nl/melodiq.nl && $SSH_COMMAND"

Write-Host ""
Write-Host "✅ Query complete!" -ForegroundColor Green
