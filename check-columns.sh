#!/bin/bash
# Check which columns exist in the tracks table

echo "🔍 Checking tracks table columns..."
echo ""

docker compose exec -T db psql -U musiq -d musiq -c "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tracks' 
AND column_name IN ('audio_url_hd', 's3_key_hd', 'rating', 'format_hd')
ORDER BY column_name;
"

echo ""
echo "Expected columns:"
echo "  - audio_url_hd (text)"
echo "  - s3_key_hd (text)"
echo "  - rating (character varying)"
echo "  - format_hd (character varying)"
