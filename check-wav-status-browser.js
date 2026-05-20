// BROWSER CONSOLE CHECK
// Open DevTools (F12) → Console tab → plak deze code:

(async function checkWavStatus() {
  console.clear();
  console.log("🔍 Checking WAV status for recent tracks...\n");

  try {
    const res = await fetch("/api/tracks");
    const data = await res.json();
    const tracks = data.tracks || [];

    // Filter "Wie de nacht volgt" tracks
    const targetTracks = tracks.filter(t => 
      t.title && t.title.includes("Wie de nacht volgt")
    );

    console.log(`📊 Found ${targetTracks.length} "Wie de nacht volgt" tracks\n`);

    targetTracks.forEach((t, i) => {
      console.log(`Track ${i + 1}: ${t.title}`);
      console.log(`  ID: ${t.id}`);
      console.log(`  Status: ${t.status}`);
      console.log(`  Provider: ${t.provider}`);
      console.log(`  Created: ${new Date(t.createdAt).toLocaleString()}`);
      console.log(`  jobId: ${t.jobId || 'NULL'}`);
      console.log(`  audioId: ${t.audioId || 'NULL'}`);
      console.log(`  wavJobId: ${t.wavJobId || 'NULL ❌'}`);
      console.log(`  s3Key: ${t.s3Key ? '✅' : '❌ null'}`);
      console.log(`  audioUrl: ${t.audioUrl ? '✅' : '❌ null'}`);
      console.log(`  s3KeyHd: ${t.s3KeyHd ? '✅ ' + t.s3KeyHd : '❌ null'}`);
      console.log(`  audioUrlHd: ${t.audioUrlHd ? '✅ ' + t.audioUrlHd : '❌ null'}`);
      console.log(`  formatHd: ${t.formatHd || 'null'}`);
      console.log(`  🎯 WAV button should: ${t.s3KeyHd && t.audioUrlHd ? 'SHOW ✅' : 'NOT SHOW ❌'}`);
      console.log('');
    });

    // Show all recent PoYo tracks
    console.log("📋 All recent PoYo tracks:");
    const poyoTracks = tracks.filter(t => t.provider === 'poyo').slice(0, 5);
    poyoTracks.forEach((t, i) => {
      const hasWav = t.s3KeyHd && t.audioUrlHd;
      const hasWavJobId = !!t.wavJobId;
      console.log(
        `  ${i + 1}. [${t.status}] ${t.title || t.prompt.substring(0, 30)} ${hasWav ? '✅ WAV' : '❌ no WAV'} ${hasWavJobId ? '(wavJobId: ✅)' : '(wavJobId: ❌)'}`
      );
    });

  } catch (error) {
    console.error("❌ Error:", error);
  }
})();
