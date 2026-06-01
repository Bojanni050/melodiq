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
  console.log("      MELODIQ MANUAL TRACK TIMINGS HEALER (DIAGNOSTIC)");
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
    let successfulUrl: string = "";
    let successfulMethod: string = "";

    const key = poyoApiKey;

    // Define multiple endpoint structures to test
    const attempts = [
      {
        name: "GET with path parameter (standard style)",
        fn: () => axios.get(`https://api.poyo.ai/api/generate/detail/music/${taskId}`, {
          headers: { Authorization: `Bearer ${key}` }
        }),
        url: `https://api.poyo.ai/api/generate/detail/music/${taskId}`,
        method: "GET"
      },
      {
        name: "GET with task_id query parameter",
        fn: () => axios.get(`https://api.poyo.ai/api/generate/detail/music?task_id=${taskId}`, {
          headers: { Authorization: `Bearer ${key}` }
        }),
        url: `https://api.poyo.ai/api/generate/detail/music?task_id=${taskId}`,
        method: "GET"
      },
      {
        name: "GET with id query parameter",
        fn: () => axios.get(`https://api.poyo.ai/api/generate/detail/music?id=${taskId}`, {
          headers: { Authorization: `Bearer ${key}` }
        }),
        url: `https://api.poyo.ai/api/generate/detail/music?id=${taskId}`,
        method: "GET"
      },
      {
        name: "POST with task_id in body",
        fn: () => axios.post(`https://api.poyo.ai/api/generate/detail/music`, { task_id: taskId }, {
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }
        }),
        url: `https://api.poyo.ai/api/generate/detail/music`,
        method: "POST"
      }
    ];

    for (const attempt of attempts) {
      try {
        console.log(`\n⏳ Trying: ${attempt.name}`);
        const response = await attempt.fn();
        statusData = response.data;
        successfulUrl = attempt.url;
        successfulMethod = attempt.method;
        console.log(`✅ Success! Endpoint: [${attempt.method}] ${attempt.url}`);
        break;
      } catch (err: any) {
        console.log(`❌ Failed ${attempt.name}: ${err.message}`);
        if (err.response) {
          console.log(`   Status: ${err.response.status}`);
          console.log(`   Response: ${JSON.stringify(err.response.data).substring(0, 200)}`);
        }
      }
    }

    if (!statusData) {
      console.error("\n❌ Error: All endpoint attempts failed. Unable to fetch details from PoYo API!");
      return;
    }

    // Extract status value
    const statusValue = (
      statusData.status || 
      statusData.data?.status || 
      ""
    ).toLowerCase();

    console.log(`\n🌐 PoYo task status: "${statusValue}"`);

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
      console.log("Successful API call:", `[${successfulMethod}] ${successfulUrl}`);
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
