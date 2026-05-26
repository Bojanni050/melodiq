"use client";

import { useState } from "react";

type RecoveryResult = {
  success: boolean;
  message: string;
  recovered?: number;
  still_processing?: number;
  total?: number;
  results?: {
    trackId: string;
    conversionId: string;
    outcome: "recovered" | "still_processing" | "failed" | "no_audio";
    detail?: string;
  }[];
};

export default function MusicGptRecoverySection() {
  const [recovering, setRecovering] = useState(false);
  const [result, setResult] = useState<RecoveryResult | null>(null);

  async function handleRecover() {
    setRecovering(true);
    setResult(null);
    try {
      const res = await fetch("/api/tracks/recover-musicgpt", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: data.message, recovered: data.recovered, still_processing: data.still_processing, total: data.total, results: data.results ?? [] });
      } else {
        setResult({ success: false, message: data.error || "Recovery failed" });
      }
    } catch {
      setResult({ success: false, message: "Network error — could not reach recovery endpoint" });
    } finally {
      setRecovering(false);
    }
  }

  return (
    <section className="section-card">
      <h2 className="text-sm font-semibold mb-1">MusicGPT — Track Recovery</h2>
      <p className="text-xs text-white/40 mb-3">
        Haal tracks op die vastzitten op &ldquo;generating&rdquo; door de MusicGPT API
        rechtstreeks te pollen op status. Veilig om meerdere keren aan te roepen.
      </p>
      <div className="flex items-center gap-2">
        <button onClick={handleRecover} disabled={recovering} className="btn-secondary text-xs px-3 py-1.5">
          {recovering ? "Recovering..." : "Recover Stuck Tracks"}
        </button>
      </div>
      {result && (
        <div className="mt-3 space-y-2">
          <p className={`text-xs ${result.success ? "text-green-400" : "text-red-400"}`}>{result.message}</p>
          {result.success && result.total !== undefined && (
            <p className="text-xs text-white/30">
              {result.recovered} recovered · {result.still_processing} still processing · {result.total} total
            </p>
          )}
          {result.results && result.results.length > 0 && (
            <div className="mt-2 space-y-1">
              {result.results.map((r) => {
                const color = r.outcome === "recovered" ? "text-green-400" : r.outcome === "still_processing" ? "text-yellow-400" : r.outcome === "no_audio" ? "text-orange-400" : "text-red-400";
                const label = r.outcome === "recovered" ? "✓ Recovered" : r.outcome === "still_processing" ? "⟳ Still processing" : r.outcome === "no_audio" ? "⚠ No audio" : "✗ Failed";
                return (
                  <div key={r.trackId} className="flex items-start gap-2 text-xs bg-white/5 rounded px-2 py-1.5">
                    <span className={`shrink-0 font-medium ${color}`}>{label}</span>
                    <span className="text-white/30 font-mono truncate">{r.conversionId}</span>
                    {r.detail && (
                      <span className="text-white/20 ml-auto shrink-0 truncate max-w-[140px]" title={r.detail}>
                        {r.detail}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
