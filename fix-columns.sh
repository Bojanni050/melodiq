#!/bin/bash
# Add missing columns to tracks table

echo "🔧 Adding missing columns to tracks table..."
echo ""

docker compose exec -T db psql -U sonara -d sonara << 'EOF'
-- Add columns if they don't exist
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS audio_url_hd TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS s3_key_hd TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS format_hd VARCHAR(10);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS rating VARCHAR(10);

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tracks' 
AND column_name IN ('audio_url_hd', 's3_key_hd', 'rating', 'format_hd')
ORDER BY column_name;
EOF

echo ""
echo "✅ Done! All columns should now exist."
