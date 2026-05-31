#!/bin/bash

# Check WAV status for recent PoYo tracks
echo "🔍 Checking WAV status for recent PoYo tracks..."
echo ""

docker compose exec -T db psql -U melodiq -d melodiq << 'EOF'
SELECT 
  id,
  title,
  status,
  CASE WHEN audio_id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_audio_id,
  CASE WHEN wav_job_id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_wav_job_id,
  CASE WHEN s3_key_hd IS NOT NULL THEN 'YES' ELSE 'NO' END as has_s3_key_hd,
  CASE WHEN audio_url_hd IS NOT NULL THEN 'YES' ELSE 'NO' END as has_audio_url_hd,
  created_at
FROM tracks 
WHERE provider = 'poyo' 
  AND status = 'done'
ORDER BY created_at DESC 
LIMIT 10;
EOF

echo ""
echo "💡 Tracks without WAV (has_s3_key_hd = NO) need WAV conversion request"
