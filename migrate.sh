#!/bin/bash
# Run database migration
# Usage: bash migrate.sh

echo "🗄️  Running database migration..."
echo ""

# Run init.ts to ensure all columns exist (handles ALTER TABLE)
echo "📋 Ensuring all columns exist..."
docker compose exec app node -e "require('./src/db/init.ts').initializeDatabase().then(() => console.log('Init complete')).catch(e => console.error(e))"

echo ""
echo "📦 Running Drizzle migrations..."
docker compose exec app npx drizzle-kit push

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration complete!"
else
    echo ""
    echo "❌ Migration failed!"
    exit 1
fi
