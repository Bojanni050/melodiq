import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set");
    return;
  }

  const sql = postgres(databaseUrl);
  try {
    const results = await sql`
      SELECT id, title, provider, status, lyrics_timestamps IS NOT NULL as has_timestamps, s3_key_hd IS NOT NULL as has_wav, created_at
      FROM tracks 
      ORDER BY created_at DESC 
      LIMIT 10;
    `;
    console.log("RECENT TRACKS:");
    console.table(results);

    // Let's inspect a few tracks that have timestamps
    const withTimestamps = await sql`
      SELECT id, title, lyrics, lyrics_timestamps 
      FROM tracks 
      WHERE lyrics_timestamps IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 3;
    `;

    for (const t of withTimestamps) {
      console.log("\n----------------------------------------");
      console.log(`Track: "${t.title}" (${t.id})`);
      console.log("Lyrics excerpt:", t.lyrics ? t.lyrics.substring(0, 100) + "..." : "null");
      console.log("Timestamps excerpt:", t.lyrics_timestamps ? t.lyrics_timestamps.substring(0, 300) + "..." : "null");
      try {
        const parsed = JSON.parse(t.lyrics_timestamps);
        const hasTaskId = !!(parsed.task_id || parsed.taskId || (parsed.data && (parsed.data.task_id || parsed.data.taskId)));
        console.log("Is JSON:", true);
        console.log("Contains task_id:", hasTaskId);
        console.log("Has lines/words/result/output:", !!(parsed.lines || parsed.words || parsed.result || parsed.output || parsed.data?.lines || parsed.data?.words || parsed.data?.result || parsed.data?.output));
      } catch (err: any) {
        console.log("Failed to parse JSON:", err.message);
      }
    }

  } catch (error) {
    console.error("DB Query failed:", error);
  } finally {
    await sql.end();
  }
}

main();
