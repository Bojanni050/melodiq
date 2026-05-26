"use client";

import type { ConfirmAction } from "@/lib/lyrics-studio-types";

export default function LyricsConfirmModal({
  confirmAction,
  onConfirm,
  onCancel,
}: {
  confirmAction: ConfirmAction;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!confirmAction) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-[#2b1f10] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-3">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-amber-100">
              {confirmAction === "replaceBlocks" && "Huidige blocks vervangen door de gekozen preset?"}
              {confirmAction === "replaceStudio" && "Studio bevat al data. Wil je die vervangen met deze lyrics en style?"}
              {confirmAction === "clearAll" && "Weet je zeker dat je alle Lyric Studio data wilt wissen?"}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={onConfirm}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-100 transition hover:bg-amber-500/25"
              >
                Bevestigen
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-xs font-medium text-white/60 transition hover:bg-white/5 hover:text-white/80"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
