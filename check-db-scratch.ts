import postgres from "postgres";

const databaseUrl = "postgresql://postgres:postgres@localhost:5432/melodiq";

async function main() {
  const sql = postgres(databaseUrl);
  try {
    const results = await sql`
      SELECT id, title, provider, status, lyrics_timestamps IS NOT NULL as has_timestamps, s3_key_hd IS NOT NULL as has_wav, format, format_hd, created_at
      FROM tracks 
      ORDER BY created_at DESC 
      LIMIT 10;
    `;
    console.log("RECENT TRACKS:");
    console.table(results);
  } catch (error) {
    console.error("DB Query failed:", error);
  } finally {
    await sql.end();
  }
}

main();
