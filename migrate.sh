#!/bin/bash
# Run database migration
# Usage: bash migrate.sh

echo "🗄️  Running database migration..."
echo ""

docker compose exec app npx drizzle-kit push

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration complete!"
else
    echo ""
    echo "❌ Migration failed!"
    exit 1
fi
