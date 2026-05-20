// BROWSER CONSOLE VERSION
// Open de app in je browser, open DevTools (F12), ga naar Console tab, en plak deze code:

(async function checkTracksInBrowser() {
  console.clear();
  console.log("🔍 Checking /api/tracks response...\n");

  try {
    const res = await fetch("/api/tracks", {
      credentials: "include",
    });

    if (!res.ok) {
      console.error("❌ API error:", res.status, res.statusText);
      return;
    }

    const data = await res.json();
    const tracks = data.tracks || [];

    console.log(`📊 Total tracks: ${tracks.length}\n`);

    // Filter PoYo tracks with status "done"
    const poyoTracks = tracks.filter(
      (t) => t.provider === "poyo" && t.status === "done"
    );

    console.log(`🎵 PoYo "done" tracks: ${poyoTracks.length}\n`);

    if (poyoTracks.length === 0) {
      console.log("⚠️  No PoYo tracks with status 'done' found.");
      console.log("   Generate a track with PoYo first to test WAV downloads.\n");
    } else {
      console.log("🔍 Checking PoYo tracks for HD audio:\n");
      poyoTracks.forEach((track, i) => {
        console.log(`Track ${i + 1}: ${track.title || track.prompt.substring(0, 40)}`);
        console.log(`  ID: ${track.id}`);
        console.log(`  Status: ${track.status}`);
        console.log(`  s3KeyHd: ${track.s3KeyHd ? "✅ " + track.s3KeyHd : "❌ null"}`);
        console.log(`  audioUrlHd: ${track.audioUrlHd ? "✅ " + track.audioUrlHd : "❌ null"}`);
        console.log(`  formatHd: ${track.formatHd || "null"}`);
        console.log(
          `  🎯 WAV button should ${track.s3KeyHd && track.audioUrlHd ? "SHOW ✅" : "NOT SHOW ❌"}\n`
        );
      });
    }

    console.log("📋 Recent 5 tracks (all providers):");
    tracks.slice(0, 5).forEach((t, i) => {
      const hasHd = t.s3KeyHd && t.audioUrlHd;
      console.log(
        `  ${i + 1}. [${t.status}] ${t.provider} - ${(t.title || t.prompt).substring(0, 40)} ${hasHd ? "✅ HD" : ""}`
      );
    });

    console.log("\n✅ Check complete. If s3KeyHd and audioUrlHd are both null, the WAV webhook hasn't fired yet or the database columns are missing.");
  } catch (error) {
    console.error("❌ Error:", error);
  }
})();
