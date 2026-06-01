import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import postgres from "postgres";
import axios from "axios";

// Helper to get PoYo status
async function getPoYoStatus(jobId: string, apiKey: string): Promise<any> {
  const response = await axios.get(
    `https://api.poyo.ai/api/generate/status/${jobId}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );
  return response.data;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ Error: DATABASE_URL is not set in environment or env files!");
    return;
  }

  const sql = postgres(databaseUrl);

  let poyoApiKey = process.env.POYO_API_KEY;
  if (!poyoApiKey) {
    try {
      const settingsResult = await sql`
        SELECT value FROM settings WHERE key = 'POYO_API_KEY';
      `;
      if (settingsResult.length > 0) {
        poyoApiKey = settingsResult[0].value;
      }
    } catch (e: any) {
      console.warn("⚠️ Warning: Could not fetch POYO_API_KEY from settings table:", e.message);
    }
  }

  // Get track ID from command line arguments
  const trackId = process.argv[2] || "063883e0-4e12-4aea-beb0-a266c81a7933";

  console.log("====================================================");
  console.log("      MELODIQ MANUAL TRACK TIMINGS HEALER");
  console.log("====================================================");
  console.log("DATABASE URL:", databaseUrl.replace(/:[^:@]+@/, ":****@"));
  console.log("POYO API KEY:", poyoApiKey ? "✅ Found (Loaded from Database Settings)" : "❌ Missing!");
  console.log("TARGET TRACK ID:", trackId);
  console.log("----------------------------------------------------");

  try {
    console.log(`⏳ Fetching track ${trackId} from database...`);

    const result = await sql`
      SELECT id, title, provider, lyrics_timestamps 
      FROM tracks 
      WHERE id = ${trackId};
    `;

    if (result.length === 0) {
      console.error(`❌ Error: Track ${trackId} was not found in the database!`);
      return;
    }

    const track = result[0];
    console.log(`✅ Found Track: "${track.title}" (${track.provider})`);
    console.log(`   Current timestamps data:`, track.lyrics_timestamps ? track.lyrics_timestamps.substring(0, 120) + "..." : "null");

    if (!track.lyrics_timestamps) {
      console.error("❌ Error: This track has no lyrics_timestamps metadata at all!");
      return;
    }

    let rawData: any;
    try {
      rawData = JSON.parse(track.lyrics_timestamps);
    } catch (e: any) {
      console.error("❌ Error parsing lyrics_timestamps JSON:", e.message);
      return;
    }

    // Extract task ID from PoYo status/submit JSON
    const taskId = rawData.task_id || rawData.taskId || rawData.data?.task_id || rawData.data?.taskId;
    
    if (!taskId) {
      console.error("❌ Error: Could not extract a PoYo task_id from the track's lyrics_timestamps column!");
      console.log("   Timestamps column JSON structure:", JSON.stringify(rawData, null, 2));
      return;
    }

    console.log(`🚀 Found PoYo task ID: "${taskId}"`);

    if (!poyoApiKey) {
      console.error("❌ Error: POYO_API_KEY is missing! Cannot request timings from PoYo API.");
      return;
    }

    console.log(`⏳ Querying PoYo API for status of task ${taskId}...`);
    const statusData = await getPoYoStatus(taskId, poyoApiKey);
    
    const statusValue = (statusData.status || statusData.data?.status || "").toLowerCase();
    console.log(`🌐 PoYo task status: "${statusValue}"`);

    const isDone = statusValue === "completed" || statusValue === "finished";

    if (isDone) {
      const finalTimestamps = JSON.stringify(statusData);
      console.log("\n⏳ Timings retrieved successfully! Updating database...");
      
      const updateResult = await sql`
        UPDATE tracks 
        SET lyrics_timestamps = ${finalTimestamps} 
        WHERE id = ${trackId}
        RETURNING id, title;
      `;
      
      console.log("====================================================");
      console.log("🎉 SUCCESS: Track has been successfully healed in the DB!");
      console.log("====================================================");
      console.log("Updated Track:", updateResult[0].title);
    } else {
      console.log("\n====================================================");
      console.log(`⚠️  NOTICE: The task is not finished on PoYo side yet.`);
      console.log(`   Task Status: ${statusValue}`);
      console.log("====================================================");
    }

  } catch (error: any) {
    console.error("\n❌ Healing failed:", error.message);
    if (error.response) {
      console.error("API response error data:", error.response.data);
    }
  } finally {
    await sql.end();
  }
}

main();
