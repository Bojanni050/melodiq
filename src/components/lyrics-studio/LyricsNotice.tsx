"use client";

import type { LyricsStudioNotice } from "@/lib/lyrics-studio-types";

export default function LyricsNotice({
  notice,
  onClose,
}: {
  notice: LyricsStudioNotice | null;
  onClose: () => void;
}) {
  if (!notice) return null;

  return (
    <div className="fixed right-4 top-4 z-[90] w-[min(420px,calc(100vw-2rem))] rounded-2xl border border-red-500/30 bg-[#201215] px-4 py-3 shadow-2xl">
      <div className="flex items-start gap-3">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-red-100">{notice.message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-red-200/70 hover:text-red-100"
          aria-label="Sluit melding"
          title="Sluiten"
        >
          x
        </button>
      </div>
    </div>
  );
}
