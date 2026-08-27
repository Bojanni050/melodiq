"use client";

import type { LibraryTrack } from "./types";
import { useT } from "@/hooks/useT";

interface TrashPanelProps {
  tracks: LibraryTrack[];
  loading: boolean;
  onRestore: (trackId: string) => void;
  onDeleteForever: (trackId: string) => void;
}

export default function TrashPanel({ tracks, loading, onRestore, onDeleteForever }: TrashPanelProps) {
  const t = useT();
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("library.recycleBin")}</h2>
          <p className="text-sm text-white/40 mt-0.5">{t("library.recycleBinDesc")}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-white/30 text-sm">{t("library.loading")}</div>
      ) : tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-white/30">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <p className="text-sm">{t("library.recycleBinEmpty")}</p>
        </div>
      ) : (
        <div className="divide-y divide-white/5 rounded-xl border border-white/5 overflow-hidden">
          {tracks.map((track) => (
            <div key={track.id} className="flex items-center gap-3 px-4 py-3 bg-white/2 hover:bg-white/5 transition-colors">
              <div className="w-10 h-10 rounded-md shrink-0 overflow-hidden bg-white/5 flex items-center justify-center">
                {track.s3KeyCover ? (
                  <img src={`/api/tracks/${track.id}/cover`} alt="" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-4 h-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/80 truncate">{track.title || track.prompt?.substring(0, 60) || t("library.untitled")}</p>
                <p className="text-xs text-white/35 mt-0.5">
                  {t("library.deletedOn", { date: track.deletedAt ? new Date(track.deletedAt).toLocaleDateString() : t("library.deletedRecently") })}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onRestore(track.id)}
                  className="text-sm text-white/50 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/10"
                >
                  {t("library.restore")}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteForever(track.id)}
                  className="text-sm text-red-400/60 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
                >
                  {t("library.deleteForever")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
