"use client";

export default function DeleteSongDialog({
  songName,
  trackCount,
  onDeleteSongOnly,
  onDeleteSongAndTracks,
  onCancel,
}: {
  songName: string;
  trackCount: number;
  onDeleteSongOnly: () => void;
  onDeleteSongAndTracks: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl p-6 w-96 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <p className="text-sm text-white/80 leading-relaxed">
            Delete &ldquo;{songName}&rdquo;? {trackCount > 0 ? `It has ${trackCount} track version${trackCount === 1 ? "" : "s"}.` : ""}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={onDeleteSongOnly}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10"
          >
            <span className="block font-medium">Delete song only</span>
            <span className="block text-xs text-white/40">Track versions stay, just ungrouped</span>
          </button>
          <button
            onClick={onDeleteSongAndTracks}
            className="w-full rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-2 text-left text-sm text-red-200 transition-colors hover:bg-red-500/20"
          >
            <span className="block font-medium">Delete song and tracks</span>
            <span className="block text-xs text-red-300/60">Track versions move to the recycle bin</span>
          </button>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
