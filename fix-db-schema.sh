#!/bin/bash
# Run-once script to fix missing database columns
# Safe to run multiple times - uses IF NOT EXISTS

echo "🔧 Fixing missing database columns in tracks table..."
echo ""

docker compose exec -T db psql -U sonara -d sonara << 'EOF'
-- Add missing columns (safe - IF NOT EXISTS)
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS audio_url_hd TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS s3_key_hd TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS format_hd VARCHAR(10);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS rating VARCHAR(10);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS wav_job_id VARCHAR(255);

-- Show confirmation
\echo ''
\echo '✅ Columns added/verified. Current tracks table columns:'
\echo ''

SELECT 
  column_name, 
  data_type,
  CASE WHEN is_nullable = 'YES' THEN 'NULL' ELSE 'NOT NULL' END as nullable
FROM information_schema.columns 
WHERE table_name = 'tracks' 
ORDER BY ordinal_position;
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database schema fixed!"
    echo "🔄 Restart the app container to pick up changes:"
    echo "   docker compose restart app"
else
    echo ""
    echo "❌ Fix failed! Check database connection."
    exit 1
fi
