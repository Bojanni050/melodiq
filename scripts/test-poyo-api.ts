import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(".env.local") });

async function run() {
  const { db } = await import("../src/db");
  const { tracks } = await import("../src/db/schema");
  const { getSetting } = await import("../src/lib/settings");
  const { getPoYoStatus, getPoYoStatusValue } = await import("../src/lib/providers/poyo");
  const { getOriginalPoYoTaskId } = await import("../src/lib/request-wav-conversion");

  try {
    const apiKey = await getSetting("POYO_API_KEY") || process.env.POYO_API_KEY;
    console.log("PoYo API Key exists:", !!apiKey);
    if (apiKey) {
      console.log("PoYo API Key prefix:", apiKey.substring(0, 5) + "...");
    }

    const allTracks = await db.select().from(tracks).orderBy(tracks.createdAt);
    const generating = allTracks.filter((t) => t.status === "generating" || t.status === "pending");
    console.log(`\nFound ${generating.length} active tracks in database:`);
    
    for (const t of generating) {
      console.log(`\n--- Track ${t.id} ---`);
      console.log(`Title: ${t.title}`);
      console.log(`Provider: ${t.provider}`);
      console.log(`Job ID: ${t.jobId}`);
      
      if (t.provider === "poyo" && t.jobId) {
        const sourceJobId = getOriginalPoYoTaskId(t.jobId);
        console.log(`Querying PoYo API for original Job ID: ${sourceJobId}...`);
        try {
          const status = await getPoYoStatus(sourceJobId);
          console.log("PoYo API Status payload:", JSON.stringify(status).substring(0, 300));
          const statusValue = getPoYoStatusValue(status);
          console.log("Parsed Status Value:", statusValue);
        } catch (e: any) {
          console.error("Failed to query PoYo API:", e.message || e);
        }
      }
    }
  } catch (error) {
    console.error("Error executing query:", error);
  } finally {
    process.exit(0);
  }
}

run();
