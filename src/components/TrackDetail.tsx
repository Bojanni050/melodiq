"use client";

import { useState } from "react";

interface TrackDetailProps {
  track: {
    id: string;
    title: string | null;
    provider: string;
    providerModel: string;
    prompt: string;
    lyrics: string | null;
    status: string;
    audioUrl: string | null;
    audioUrlHd: string | null;
    createdAt: string;
    error: string | null;
    s3KeyHd: string | null;
    coverUrl?: string | null;
    s3KeyCover?: string | null;
  };
  onClose: () => void;
  onPlay: (url: string) => void;
  onDownload: (url: string, hd: boolean) => void;
  mode?: "overlay" | "sidebar";
}

export default function TrackDetail({ track, onClose, onPlay, onDownload, mode = "overlay" }: TrackDetailProps) {
  const [downloading, setDownloading] = useState(false);

  function handleDownload(url: string, hd = false) {
    setDownloading(true);
    onDownload(url, hd);
    setTimeout(() => setDownloading(false), 1000);
  }

  const title = track.title || track.prompt.substring(0, 60);

  const panelContent = (
    <>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0d0d12]/95 backdrop-blur-sm border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/60">Track Details</h3>
        <button onClick={onClose} className="text-white/50 hover:text-white" title="Close details">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Artwork */}
      <div className="aspect-square relative bg-linear-to-br from-primary-500/20 to-purple-500/20 overflow-hidden">
        {track.coverUrl ? (
          <img
            src={track.coverUrl}
            alt={track.title || "Cover art"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-24 h-24 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-6 py-4 space-y-4">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm text-white/40 mt-1">
            {track.provider} • {track.providerModel}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {track.status === "done" && track.audioUrl && (
            <>
              <button
                onClick={() => onPlay(track.audioUrl!)}
                className="flex-1 btn-primary py-2.5 text-sm"
              >
                Play
              </button>
              <button
                onClick={() => handleDownload(track.audioUrl!)}
                disabled={downloading}
                className="btn-secondary text-sm px-3 py-2.5"
              >
                MP3
              </button>
              {track.s3KeyHd && track.audioUrlHd && (
                <button
                  onClick={() => handleDownload(track.audioUrlHd!, true)}
                  disabled={downloading}
                  className="btn-secondary text-sm px-3 py-2.5"
                >
                  HD
                </button>
              )}
            </>
          )}
        </div>

        {/* Prompt */}
        <div>
          <h4 className="text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">Prompt</h4>
          <p className="text-sm text-white/70 leading-relaxed">{track.prompt}</p>
        </div>

        {/* Lyrics */}
        {track.lyrics && (
          <div>
            <h4 className="text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">Lyrics</h4>
            <pre className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed font-mono">{track.lyrics}</pre>
          </div>
        )}

        {/* Error */}
        {track.error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400">{track.error}</p>
          </div>
        )}
      </div>
    </>
  );

  if (mode === "sidebar") {
    return (
      <div className="h-full w-full bg-[#0d0d12] overflow-y-auto">
        {panelContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-md bg-[#0d0d12] border-l border-white/5 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {panelContent}
      </div>
    </div>
  );
}
