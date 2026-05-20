#!/bin/bash

# Add wav_job_id column to tracks table
# Safe to run multiple times (uses IF NOT EXISTS)

echo "🔧 Adding wav_job_id column to tracks table..."
echo ""

docker compose exec -T db psql -U sonara -d sonara << 'EOF'
-- Add wav_job_id column
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS wav_job_id VARCHAR(255);

-- Show result
\d tracks
EOF

echo ""
echo "✅ Column added successfully!"
echo ""
echo "🔄 Restart the app container:"
echo "   docker compose restart app"
