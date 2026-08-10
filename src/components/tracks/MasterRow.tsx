"use client";

import { useEffect, useState } from "react";

type MasterDef = { value: string; label: string };
type MasterRecord = { id: string; variationCategory: string; status: "pending" | "completed" | "failed"; audioUrl: string | null; createdAt: string; completedAt: string | null };

// Inline master row (self-fetching)
export default function MasterRow({ variationDef, trackId }: { variationDef: MasterDef; trackId: string }) {
  const [master, setMaster] = useState<MasterRecord | null>(null);
  const [mastering, setMastering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/tracks/${trackId}/masters`)
      .then((r) => r.ok ? r.json() : [])
      .then((list: MasterRecord[]) => setMaster(list.find((m) => m.variationCategory === variationDef.value) ?? null))
      .catch(() => null);
  }, [trackId, variationDef.value]);

  // Poll while pending
  useEffect(() => {
    if (master?.status !== "pending") return;
    const id = setTimeout(() => {
      fetch(`/api/tracks/${trackId}/masters`)
        .then((r) => r.ok ? r.json() : [])
        .then((list: MasterRecord[]) => setMaster(list.find((m) => m.variationCategory === variationDef.value) ?? null))
        .catch(() => null);
    }, 4000);
    return () => clearTimeout(id);
  }, [master, trackId, variationDef.value]);

  async function handleMaster() {
    setMastering(true); setError(null);
    try {
      const res = await fetch(`/api/tracks/${trackId}/masters`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variationCategory: variationDef.value }) });
      if (!res.ok) { const p = await res.json().catch(() => null); setError(p?.error ?? "Failed"); return; }
      setMaster(await res.json());
    } catch { setError("Failed to start mastering"); }
    finally { setMastering(false); }
  }

  const isMastering = master?.status === "pending" || mastering;
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <span className="text-sm text-white/70">{variationDef.label}</span>
      {error && <span className="text-[11px] text-red-300">{error}</span>}
      {master?.status === "completed" && master.audioUrl ? (
        <a href={master.audioUrl} download className="rounded px-2 py-1 text-[11px] text-primary-300 hover:bg-primary-500/10 transition-colors">Download</a>
      ) : isMastering ? (
        <span className="text-[11px] text-white/40">Mastering…</span>
      ) : (
        <button type="button" onClick={handleMaster} disabled={mastering} className="rounded px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors disabled:opacity-40">
          {master?.status === "failed" ? "Retry" : "Master"}
        </button>
      )}
    </div>
  );
}
