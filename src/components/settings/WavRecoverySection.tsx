"use client";

import { useState } from "react";

type RecoveryResult = {
  success: boolean;
  message: string;
  retried?: number;
  total?: number;
  results?: {
    trackId: string;
    success: boolean;
    wavJobId?: string;
  }[];
};

export default function WavRecoverySection() {
  const [recovering, setRecovering] = useState(false);
  const [result, setResult] = useState<RecoveryResult | null>(null);

  async function handleRecover() {
    setRecovering(true);
    setResult(null);
    try {
      const res = await fetch("/api/tracks/retry-wav", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult({
          success: true,
          message: data.message,
          retried: data.retried,
          total: data.total,
          results: data.results ?? [],
        });
      } else {
        setResult({ success: false, message: data.error || "Herstel mislukt" });
      }
    } catch {
      setResult({ success: false, message: "Netwerkfout — kon herstel-endpoint niet bereiken" });
    } finally {
      setRecovering(false);
    }
  }

  return (
    <section className="section-card">
      <h2 className="text-sm font-semibold mb-1">WAV/FLAC-conversie</h2>
      <p className="text-sm text-white/40 mb-3">
        WAV/HD-conversie gebeurt niet meer automatisch — vraag het per track aan via "Convert to WAV"
        in het trackmenu, of gebruik deze knop om het in één keer aan te vragen voor alle PoYo- en
        APIMart-tracks die succesvol zijn gegenereerd (Ready/Done) maar nog geen HD-bestand hebben.
        Veilig om meerdere keren uit te voeren.
      </p>
      <div className="flex items-center gap-2">
        <button onClick={handleRecover} disabled={recovering} className="btn-secondary text-sm px-3 py-1.5">
          {recovering ? "Bezig met herstellen..." : "Herstel Ontbrekende WAV Tracks"}
        </button>
      </div>
      {result && (
        <div className="mt-3 space-y-2">
          <p className={`text-sm ${result.success ? "text-green-400" : "text-red-400"}`}>{result.message}</p>
          {result.success && result.total !== undefined && (
            <p className="text-sm text-white/30">
              {result.retried} van de {result.total} in aanmerking komende tracks opnieuw aangevraagd
            </p>
          )}
          {result.results && result.results.length > 0 && (
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto pr-1">
              {result.results.map((r) => {
                const color = r.success ? "text-green-400" : "text-red-400";
                const label = r.success ? "✓ Aangevraagd" : "✗ Mislukt";
                return (
                  <div key={r.trackId} className="flex items-start gap-2 text-xs bg-white/5 rounded px-2 py-1.5">
                    <span className={`shrink-0 font-medium ${color}`}>{label}</span>
                    <span className="text-white/40 truncate">Track: {r.trackId.substring(0, 8)}...</span>
                    {r.wavJobId && (
                      <span className="text-white/20 ml-auto shrink-0 font-mono text-[10px]" title={r.wavJobId}>
                        Job: {r.wavJobId.substring(0, 12)}...
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
