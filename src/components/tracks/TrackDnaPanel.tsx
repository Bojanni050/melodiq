"use client";

import { useEffect, useState } from "react";

interface AudioDna {
  tempo: number | null;
  key: string | null;
  energy: number | null;
  loudness: number | null;
  atmosphereTags: string[] | null;
  lyricsScore: number | null;
  lyricsNotes: string | null;
  compositionScore: number | null;
  compositionNotes: string | null;
  computedAt: string;
}

interface AdvancedDnaResult {
  lyricsAnalysis: string | null;
  compositionAnalysis: string | null;
  tips: string[];
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-[0.12em] text-white/40">{label}</div>
      <div className="text-sm font-medium text-white">{value}</div>
    </div>
  );
}

// Shared shell for every Track DNA panel state (loading/not-found/pending/
// loaded) — gives them all the same blurred, zoomed-in DNA-helix watermark.
function TrackDnaCard({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className="relative mx-3 mb-2 space-y-4 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-4"
      onClick={onClick}
    >
      <div
        className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center opacity-[0.16] blur-md"
        style={{ backgroundImage: "url(/images/track-dna-bg.png)" }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

// Track DNA — auto-computed facts embedded inline on a track row (Song/Library/
// Workspaces pages). Always renders in an authenticated app context — the
// owner can view their own track regardless of publish status, per
// getTrackDnaAccess in src/lib/songs.ts — so unlike the public Discover
// Track DNA page this skips the logged-out/InlineAuthForm branch entirely.
// Read-only: tempo/key/energy/loudness are computed once from the audio right
// after generation, atmosphere tags and lyrics score come from an LLM — no
// voting involved.
export default function TrackDnaPanel({
  trackId,
  refreshKey,
  advancedDnaResult,
  advancedDnaRunning,
  onRunAdvancedDna,
  trackStatus,
}: {
  trackId: string;
  refreshKey?: number;
  advancedDnaResult?: AdvancedDnaResult | null;
  advancedDnaRunning?: boolean;
  onRunAdvancedDna?: () => void;
  trackStatus?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [audioDna, setAudioDna] = useState<AudioDna | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchDna() {
      // Skip the loading flash on a refresh (refreshKey > 0) — only the
      // initial fetch should show "Loading Track DNA…".
      if (!refreshKey) setLoading(true);
      const res = await fetch(`/api/discover/${trackId}`, { cache: "no-store" });
      if (!active) return;
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setAudioDna(data.audioDna ?? null);
      }
      setLoading(false);
    }
    fetchDna();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, refreshKey]);

  if (loading) {
    return (
      <TrackDnaCard>
        <p className="text-sm text-white/40">Loading Track DNA…</p>
      </TrackDnaCard>
    );
  }

  if (notFound) {
    return (
      <TrackDnaCard>
        <p className="text-sm text-white/40">Track DNA isn&apos;t available for this track.</p>
      </TrackDnaCard>
    );
  }

  if (!audioDna) {
    return (
      <TrackDnaCard onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-white/40">
          Analysis in progress — Track DNA will appear once the track finishes rendering.
        </p>
      </TrackDnaCard>
    );
  }

  const hasAudioFacts = audioDna.tempo != null || audioDna.key != null || audioDna.energy != null || audioDna.loudness != null;

  return (
    <TrackDnaCard onClick={(e) => e.stopPropagation()}>
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-white">Track DNA</h4>

        {hasAudioFacts && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {audioDna.tempo != null && <Fact label="Tempo" value={`${audioDna.tempo} BPM`} />}
            {audioDna.key != null && <Fact label="Key" value={audioDna.key} />}
            {audioDna.energy != null && <Fact label="Energy" value={`${audioDna.energy}%`} />}
            {audioDna.loudness != null && <Fact label="Loudness" value={`${audioDna.loudness.toFixed(1)} LUFS`} />}
          </div>
        )}

        {audioDna.atmosphereTags && audioDna.atmosphereTags.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-[0.12em] text-white/40">Atmosphere</div>
            <div className="flex flex-wrap gap-1.5">
              {audioDna.atmosphereTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs text-white/80"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {audioDna.lyricsScore != null && (
          <div className="space-y-1 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-white">Lyrics</span>
              <span className="text-white/50">{audioDna.lyricsScore.toFixed(1)}/10</span>
            </div>
            {audioDna.lyricsNotes && <p className="text-sm text-white/40">{audioDna.lyricsNotes}</p>}
          </div>
        )}

        {audioDna.compositionScore != null && (
          <div className="space-y-1 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-white">Composition</span>
              <span className="text-white/50">{audioDna.compositionScore.toFixed(1)}/10</span>
            </div>
            {audioDna.compositionNotes && <p className="text-sm text-white/40">{audioDna.compositionNotes}</p>}
          </div>
        )}

        {/* ── Advanced DNA section ───────────────────────────────────── */}
        <div className="border-t border-white/10 pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🧬</span>
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">
                Advanced Analysis
              </span>
            </div>
            {trackStatus === "done" && onRunAdvancedDna && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRunAdvancedDna(); }}
                disabled={advancedDnaRunning}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-white/10 bg-white/[0.04] text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                {advancedDnaRunning ? (
                  <>
                    <span className="w-2 h-2 rounded-full border border-white/40 border-t-transparent animate-spin" />
                    Analyzing…
                  </>
                ) : advancedDnaResult ? (
                  "Re-run"
                ) : (
                  "Run analysis"
                )}
              </button>
            )}
          </div>

          {advancedDnaRunning && !advancedDnaResult && (
            <p className="text-xs text-white/35 italic">Running advanced analysis…</p>
          )}

          {advancedDnaResult ? (
            <div className="space-y-3">
              {advancedDnaResult.lyricsAnalysis && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-white/40">Lyrics</div>
                  <p className="text-sm text-white/70 leading-relaxed">{advancedDnaResult.lyricsAnalysis}</p>
                </div>
              )}
              {advancedDnaResult.compositionAnalysis && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-white/40">Composition &amp; Mix</div>
                  <p className="text-sm text-white/70 leading-relaxed">{advancedDnaResult.compositionAnalysis}</p>
                </div>
              )}
              {advancedDnaResult.tips.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-primary-300/80">
                    {advancedDnaResult.tips.length} {advancedDnaResult.tips.length === 1 ? "tip" : "tips"} for improvement
                  </div>
                  <ol className="space-y-1.5 list-decimal list-inside">
                    {advancedDnaResult.tips.map((tip, i) => (
                      <li key={i} className="text-sm text-white/70 leading-relaxed">
                        {tip}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ) : !advancedDnaRunning && (
            <p className="text-xs text-white/30 italic">
              Run an advanced analysis for a deep-dive into lyrics, composition, and improvement tips.
            </p>
          )}
        </div>
      </div>
    </TrackDnaCard>
  );
}
