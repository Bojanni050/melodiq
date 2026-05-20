// Check wat /api/tracks teruggeeft
// Usage: node check-tracks-api.js

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

async function checkTracks() {
  try {
    console.log("🔍 Fetching tracks from:", `${API_URL}/api/tracks`);
    console.log("");

    const res = await fetch(`${API_URL}/api/tracks`, {
      credentials: "include",
      headers: {
        Cookie: process.env.TEST_COOKIE || "",
      },
    });

    if (!res.ok) {
      console.error("❌ API error:", res.status, res.statusText);
      const text = await res.text();
      console.error(text);
      return;
    }

    const data = await res.json();
    const tracks = data.tracks || [];

    console.log(`📊 Total tracks: ${tracks.length}`);
    console.log("");

    // Filter PoYo tracks with status "done"
    const poyoTracks = tracks.filter(
      (t) => t.provider === "poyo" && t.status === "done"
    );

    console.log(`🎵 PoYo "done" tracks: ${poyoTracks.length}`);
    console.log("");

    if (poyoTracks.length === 0) {
      console.log("⚠️  No PoYo tracks with status 'done' found.");
      console.log("   Generate a track with PoYo first to test WAV downloads.");
      return;
    }

    // Check HD fields
    poyoTracks.forEach((track, i) => {
      console.log(`Track ${i + 1}: ${track.title || track.prompt.substring(0, 40)}`);
      console.log(`  ID: ${track.id}`);
      console.log(`  Status: ${track.status}`);
      console.log(`  Provider: ${track.provider}`);
      console.log(`  s3Key: ${track.s3Key ? "✅" : "❌"}`);
      console.log(`  audioUrl: ${track.audioUrl ? "✅" : "❌"}`);
      console.log(`  s3KeyHd: ${track.s3KeyHd ? "✅ " + track.s3KeyHd : "❌ null"}`);
      console.log(`  audioUrlHd: ${track.audioUrlHd ? "✅ " + track.audioUrlHd : "❌ null"}`);
      console.log(`  formatHd: ${track.formatHd || "null"}`);
      console.log(
        `  🎯 WAV button should ${track.s3KeyHd && track.audioUrlHd ? "SHOW ✅" : "NOT SHOW ❌"}`
      );
      console.log("");
    });

    // Show recent tracks
    console.log("📋 Recent 5 tracks (all providers):");
    tracks.slice(0, 5).forEach((t, i) => {
      const hasHd = t.s3KeyHd && t.audioUrlHd;
      console.log(
        `  ${i + 1}. [${t.status}] ${t.provider} - ${t.title || t.prompt.substring(0, 30)} ${hasHd ? "✅ HD" : ""}`
      );
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkTracks();
