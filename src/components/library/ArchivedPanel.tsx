"use client";

import type { LibraryTrack } from "./types";

interface ArchivedPanelProps {
  tracks: LibraryTrack[];
  loading: boolean;
  onUnarchive: (trackId: string) => void;
}

export default function ArchivedPanel({ tracks, loading, onUnarchive }: ArchivedPanelProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Archived Tracks</h2>
          <p className="text-sm text-white/40 mt-0.5">Tracks you've kept but hidden from the main library — unarchive to bring them back.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-white/30 text-sm">Loading…</div>
      ) : tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-white/30">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          <p className="text-sm">No archived tracks</p>
        </div>
      ) : (
        <div className="divide-y divide-white/5 rounded-xl border border-white/5 overflow-hidden">
          {tracks.map((track) => (
            <div key={track.id} className="flex items-center gap-3 px-4 py-3 bg-white/2 hover:bg-white/5 transition-colors">
              <div className="w-10 h-10 rounded-md shrink-0 overflow-hidden bg-white/5 flex items-center justify-center">
                {track.s3KeyCover ? (
                  <img src={`/api/tracks/${track.id}/cover`} alt="" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-4 h-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/80 truncate">{track.title || track.prompt?.substring(0, 60) || "Untitled"}</p>
                <p className="text-xs text-white/35 mt-0.5">
                  Archived {track.archivedAt ? new Date(track.archivedAt).toLocaleDateString() : "recently"}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onUnarchive(track.id)}
                  className="text-sm text-white/50 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/10"
                >
                  Unarchive
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
