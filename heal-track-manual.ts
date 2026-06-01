import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import postgres from "postgres";
import axios from "axios";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ Error: DATABASE_URL is not set in environment or env files!");
    return;
  }

  const sql = postgres(databaseUrl);

  // Get track ID from command line arguments, default to the problematic one
  const trackId = process.argv[2] || "063883e0-4e12-4aea-beb0-a266c81a7933";

  console.log("====================================================");
  console.log("      MELODIQ MANUAL TRACK TIMINGS HEALER");
  console.log("====================================================");
  console.log("DATABASE URL:", databaseUrl.replace(/:[^:@]+@/, ":****@"));
  console.log("TARGET TRACK ID:", trackId);
  console.log("----------------------------------------------------");

  try {
    console.log(`⏳ Fetching track ${trackId} from database...`);

    const result = await sql`
      SELECT id, title, provider, job_id, lyrics_timestamps 
      FROM tracks 
      WHERE id = ${trackId};
    `;

    if (result.length === 0) {
      console.error(`❌ Error: Track ${trackId} was not found in the database!`);
      return;
    }

    const track = result[0];
    console.log(`✅ Found Track: "${track.title}" (${track.provider})`);
    console.log(`   Current timestamps data:`, track.lyrics_timestamps ? track.lyrics_timestamps.substring(0, 150) + "..." : "null");

    let taskId: string | null = null;

    if (track.lyrics_timestamps) {
      try {
        const parsed = JSON.parse(track.lyrics_timestamps);
        taskId = parsed.task_id || parsed.taskId || parsed.data?.task_id || parsed.data?.taskId;
      } catch (e: any) {
        console.warn("⚠️ Warning: Failed to parse current lyrics_timestamps as JSON:", e.message);
      }
    }

    if (!taskId && track.job_id) {
      // Clean up versioned suffix if present
      taskId = track.job_id.split(":")[0];
    }

    if (!taskId) {
      console.error("❌ Error: Could not resolve a PoYo task ID from lyrics_timestamps or job_id!");
      return;
    }

    console.log(`🚀 Resolved PoYo task ID: "${taskId}"`);

    let poyoApiKey = process.env.POYO_API_KEY;
    if (!poyoApiKey) {
      const settingsResult = await sql`
        SELECT value FROM settings WHERE key = 'POYO_API_KEY';
      `;
      if (settingsResult.length > 0) {
        poyoApiKey = settingsResult[0].value;
      }
    }

    if (!poyoApiKey) {
      console.error("❌ Error: POYO_API_KEY not found in settings or environment!");
      return;
    }

    console.log("⏳ Querying PoYo API for task status/details...");

    let statusData: any = null;

    try {
      // 1. Try standard GET status endpoint
      const response = await axios.get(
        `https://api.poyo.ai/api/generate/status/${taskId}`,
        {
          headers: { Authorization: `Bearer ${poyoApiKey}` }
        }
      );
      statusData = response.data;
    } catch (error: any) {
      const isMusicTask =
        error.response?.status === 400 &&
        (String(error.response?.data?.error?.message || error.response?.data?.message || "").includes("detail/music") ||
         String(error.response?.data?.error?.message || error.response?.data?.message || "").includes("music generation"));

      if (isMusicTask) {
        console.log(`[poyo] Task ${taskId} is a music generation task. Querying details via POST generate/detail/music...`);
        const response = await axios.post(
          "https://api.poyo.ai/api/generate/detail/music",
          { task_id: taskId },
          {
            headers: {
              Authorization: `Bearer ${poyoApiKey}`,
              "Content-Type": "application/json"
            }
          }
        );
        statusData = response.data;
      } else {
        throw error;
      }
    }

    if (!statusData) {
      console.error("❌ Error: Received empty status data from PoYo API!");
      return;
    }

    // Extract status value
    const statusValue = (
      statusData.status || 
      statusData.data?.status || 
      ""
    ).toLowerCase();

    console.log(`🌐 PoYo task status: "${statusValue}"`);

    const isDone = statusValue === "completed" || statusValue === "finished";

    if (isDone) {
      const finalTimestamps = JSON.stringify(statusData);
      console.log("\n⏳ Timings/Details retrieved successfully! Updating database...");
      
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
      console.error("API response error data:", JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    await sql.end();
  }
}

main();
