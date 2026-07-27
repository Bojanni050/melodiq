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
  computedAt: string;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-[0.12em] text-white/40">{label}</div>
      <div className="text-sm font-medium text-white">{value}</div>
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
export default function TrackDnaPanel({ trackId }: { trackId: string }) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [audioDna, setAudioDna] = useState<AudioDna | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchDna() {
      const res = await fetch(`/api/discover/${trackId}`);
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
  }, [trackId]);

  if (loading) {
    return (
      <div className="mx-3 mb-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/40">
        Loading Track DNA…
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-3 mb-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/40">
        Track DNA isn&apos;t available for this track.
      </div>
    );
  }

  if (!audioDna) {
    return (
      <div
        className="mx-3 mb-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/40"
        onClick={(e) => e.stopPropagation()}
      >
        Analysis in progress — Track DNA will appear once the track finishes rendering.
      </div>
    );
  }

  const hasAudioFacts = audioDna.tempo != null || audioDna.key != null || audioDna.energy != null || audioDna.loudness != null;

  return (
    <div
      className="mx-3 mb-2 space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4"
      onClick={(e) => e.stopPropagation()}
    >
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
          {audioDna.lyricsNotes && <p className="text-xs text-white/40">{audioDna.lyricsNotes}</p>}
        </div>
      )}
    </div>
  );
}
