// BROWSER CONSOLE - Retry WAV conversie voor tracks zonder HD audio
// Open DevTools (F12) → Console tab → plak deze code:

(async function retryWavConversion() {
  console.clear();
  console.log("🔄 Retrying WAV conversion for tracks without HD audio...\n");

  try {
    const res = await fetch("/api/tracks/retry-wav", {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) {
      const error = await res.json();
      console.error("❌ Request failed:", error);
      return;
    }

    const data = await res.json();

    console.log("✅ Response:", data);
    console.log(`\n📊 Results: ${data.retried}/${data.total} tracks retried`);

    if (data.results && data.results.length > 0) {
      console.log("\n📋 Details:");
      data.results.forEach((result, i) => {
        if (result.success) {
          console.log(`  ${i + 1}. ✅ Track ${result.trackId.substring(0, 8)}... → WAV job: ${result.wavJobId}`);
        } else {
          console.log(`  ${i + 1}. ❌ Track ${result.trackId.substring(0, 8)}... → Failed`);
        }
      });
    }

    console.log("\n💡 WAV conversie aangevraagd. Check over 2-5 minuten of de WAV buttons verschijnen.");

  } catch (error) {
    console.error("❌ Error:", error);
  }
})();
