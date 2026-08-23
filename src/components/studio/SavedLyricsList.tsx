"use client";

import { useState } from "react";
import { useStudioStore } from "@/lib/store";
import { useT } from "@/hooks/useT";

export default function SavedLyricsList() {
  const t = useT();
  const [showSavedLyrics, setShowSavedLyrics] = useState(false);
  const savedLyrics = useStudioStore((state) => state.savedLyrics);
  const loadSavedLyric = useStudioStore((state) => state.loadSavedLyric);
  const deleteSavedLyric = useStudioStore((state) => state.deleteSavedLyric);

  if (!savedLyrics || savedLyrics.length === 0) {
    return null;
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setShowSavedLyrics((v) => !v)}
        className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/65 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${showSavedLyrics ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {t("studio.savedLyricsCount", { count: savedLyrics.length })}
      </button>
      {showSavedLyrics && (
        <div className="mt-1.5 space-y-1 max-h-48 overflow-y-auto rounded-lg border border-white/8 bg-[#0d0d12] p-1.5">
          {savedLyrics.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5 group"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white/75 truncate">{entry.title}</p>
                <p className="text-[10px] text-white/30">
                  {new Date(entry.savedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadSavedLyric(entry.id)}
                className="shrink-0 text-[10px] text-white/40 hover:text-white/80 transition-colors px-1.5 py-0.5 rounded hover:bg-white/10"
                title={t("studio.loadTheseLyrics")}
              >
                {t("studio.load")}
              </button>
              <button
                type="button"
                onClick={() => void deleteSavedLyric(entry.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all p-0.5 rounded hover:bg-red-500/10"
                title={t("studio.delete")}
                aria-label={t("studio.deleteSavedLyrics")}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
