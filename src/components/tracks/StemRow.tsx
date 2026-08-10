"use client";

import { useEffect, useState } from "react";

type StemDef = { value: string; label: string };
type StemRecord = { id: string; stemType: string; status: "pending" | "completed" | "failed"; audioUrl: string | null; createdAt: string; completedAt: string | null };

// Inline stem row (self-fetching)
export default function StemRow({ stemDef, trackId }: { stemDef: StemDef; trackId: string }) {
  const [stem, setStem] = useState<StemRecord | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/tracks/${trackId}/stems`)
      .then((r) => r.ok ? r.json() : [])
      .then((list: StemRecord[]) => setStem(list.find((s) => s.stemType === stemDef.value) ?? null))
      .catch(() => null);
  }, [trackId, stemDef.value]);

  // Poll while pending
  useEffect(() => {
    if (stem?.status !== "pending") return;
    const id = setTimeout(() => {
      fetch(`/api/tracks/${trackId}/stems`)
        .then((r) => r.ok ? r.json() : [])
        .then((list: StemRecord[]) => setStem(list.find((s) => s.stemType === stemDef.value) ?? null))
        .catch(() => null);
    }, 4000);
    return () => clearTimeout(id);
  }, [stem, trackId, stemDef.value]);

  async function handleExtract() {
    setExtracting(true); setError(null);
    try {
      const res = await fetch(`/api/tracks/${trackId}/stems`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stemType: stemDef.value }) });
      if (!res.ok) { const p = await res.json().catch(() => null); setError(p?.error ?? "Failed"); return; }
      setStem(await res.json());
    } catch { setError("Failed to start extraction"); }
    finally { setExtracting(false); }
  }

  const isExtracting = stem?.status === "pending" || extracting;
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <span className="text-sm text-white/70">{stemDef.label}</span>
      {error && <span className="text-[11px] text-red-300">{error}</span>}
      {stem?.status === "completed" && stem.audioUrl ? (
        <a href={stem.audioUrl} download className="rounded px-2 py-1 text-[11px] text-primary-300 hover:bg-primary-500/10 transition-colors">Download</a>
      ) : isExtracting ? (
        <span className="text-[11px] text-white/40">Extracting…</span>
      ) : (
        <button type="button" onClick={handleExtract} disabled={extracting} className="rounded px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors disabled:opacity-40">
          {stem?.status === "failed" ? "Retry" : "Extract"}
        </button>
      )}
    </div>
  );
}
