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
  summary: string | null;
  lyricsAnalysis: string | null;
  compositionAnalysis: string | null;
  tips: string[];
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-[0.12em] text-ink-dim">{label}</div>
      <div className="text-sm font-medium text-ink">{value}</div>
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
      className="relative mx-3 mb-2 space-y-4 overflow-hidden  border border-line bg-white/[0.03] p-4"
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
// Track DNA page this skips the logged-out branch entirely.
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
  onReanalyzeAudio,
  reanalyzingAudio,
}: {
  trackId: string;
  refreshKey?: number;
  advancedDnaResult?: AdvancedDnaResult | null;
  advancedDnaRunning?: boolean;
  onRunAdvancedDna?: () => void;
  trackStatus?: string;
  onReanalyzeAudio?: () => void;
  reanalyzingAudio?: boolean;
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
        <p className="text-sm text-ink-dim">Loading Track DNA…</p>
      </TrackDnaCard>
    );
  }

  if (notFound) {
    return (
      <TrackDnaCard>
        <p className="text-sm text-ink-dim">Track DNA isn&apos;t available for this track.</p>
      </TrackDnaCard>
    );
  }

  if (!audioDna) {
    return (
      <TrackDnaCard onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-dim">
            {onReanalyzeAudio
              ? "No Track DNA yet — analyze this track to see tempo, key, and atmosphere."
              : "No Track DNA yet."}
          </p>
          {trackStatus === "done" && onReanalyzeAudio && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onReanalyzeAudio(); }}
              disabled={reanalyzingAudio}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
            >
              {reanalyzingAudio ? (
                <>
                  <span className="w-2 h-2 rounded-full border border-accent/50 border-t-transparent animate-spin" />
                  Analyzing…
                </>
              ) : (
                "Analyze audio"
              )}
            </button>
          )}
        </div>
      </TrackDnaCard>
    );
  }

  const hasAudioFacts = audioDna.tempo != null || audioDna.key != null || audioDna.energy != null || audioDna.loudness != null;

  return (
    <TrackDnaCard onClick={(e) => e.stopPropagation()}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-ink">Track DNA</h4>
          {trackStatus === "done" && onReanalyzeAudio && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onReanalyzeAudio(); }}
              disabled={reanalyzingAudio}
              title="Re-run tempo/key/energy/loudness detection on the audio"
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-line bg-white/[0.04] text-ink-dim hover:text-ink-muted hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {reanalyzingAudio ? (
                <>
                  <span className="w-2 h-2 rounded-full border border-line/40 border-t-transparent animate-spin" />
                  Analyzing…
                </>
              ) : hasAudioFacts ? (
                "Re-analyze audio"
              ) : (
                "Analyze audio"
              )}
            </button>
          )}
        </div>

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
            <div className="text-[10px] uppercase tracking-[0.12em] text-ink-dim">Atmosphere</div>
            <div className="flex flex-wrap gap-1.5">
              {audioDna.atmosphereTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-line bg-white/[0.06] px-2.5 py-1 text-xs text-ink-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {audioDna.lyricsScore != null && (
          <div className="space-y-1 border-t border-line pt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-ink">Lyrics</span>
              <span className="text-ink-dim">{audioDna.lyricsScore.toFixed(1)}/10</span>
            </div>
            {audioDna.lyricsNotes && <p className="text-sm text-ink-dim">{audioDna.lyricsNotes}</p>}
          </div>
        )}

        {/* ── Advanced DNA section — lyrics analysis, audio-based composition
             critique, and improvement tips all live here now (folded in from
             the former standalone "Analyze Composition" action). ────────── */}
        <div className="border-t border-line pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🧬</span>
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-dim">
                Advanced Analysis
              </span>
            </div>
            {trackStatus === "done" && onRunAdvancedDna && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRunAdvancedDna(); }}
                disabled={advancedDnaRunning}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-line bg-white/[0.04] text-ink-dim hover:text-ink-muted hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                {advancedDnaRunning ? (
                  <>
                    <span className="w-2 h-2 rounded-full border border-line/40 border-t-transparent animate-spin" />
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
            <p className="text-xs text-ink-dim italic">Running advanced analysis…</p>
          )}

          {advancedDnaResult ? (
            <div className="space-y-3">
              {advancedDnaResult.summary && (
                <p className="text-sm text-ink-muted leading-relaxed border-b border-line pb-3">
                  {advancedDnaResult.summary}
                </p>
              )}
              {advancedDnaResult.lyricsAnalysis && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-ink-dim">Lyrics</div>
                  <p className="text-sm text-ink-muted leading-relaxed">{advancedDnaResult.lyricsAnalysis}</p>
                </div>
              )}
              {advancedDnaResult.compositionAnalysis && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-ink-dim">Composition &amp; Mix</div>
                  <p className="text-sm text-ink-muted leading-relaxed">{advancedDnaResult.compositionAnalysis}</p>
                </div>
              )}
              {advancedDnaResult.tips.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-accent/80">
                    {advancedDnaResult.tips.length} {advancedDnaResult.tips.length === 1 ? "tip" : "tips"} for improvement
                  </div>
                  <ol className="space-y-1.5 list-decimal list-inside">
                    {advancedDnaResult.tips.map((tip, i) => (
                      <li key={i} className="text-sm text-ink-muted leading-relaxed">
                        {tip}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ) : !advancedDnaRunning && (
            <p className="text-xs text-ink-dim italic">
              Run an advanced analysis for a deep-dive into lyrics, composition, and improvement tips.
            </p>
          )}
        </div>
      </div>
    </TrackDnaCard>
  );
}
