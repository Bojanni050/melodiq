"use client";

import type { ArchiveEntry } from "./types";

export default function TranslationRow({
  translation,
  onEdit,
  onDelete,
}: {
  translation: ArchiveEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 cursor-pointer hover:bg-white/[0.05] transition-colors"
      onClick={onEdit}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {translation.language && (
            <span className="shrink-0 rounded-full border border-primary-400/30 bg-primary-500/10 px-2 py-0.5 text-[10px] text-primary-300">
              {translation.language}
            </span>
          )}
          <h4 className="text-sm font-medium text-white/85 truncate">{translation.title}</h4>
          {translation.trackTitle && (
            <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/50">
              Linked: {translation.trackTitle}
            </span>
          )}
        </div>
        {translation.lyrics && <p className="text-xs text-white/30 mt-1 line-clamp-1 whitespace-pre-line">{translation.lyrics}</p>}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="shrink-0 p-1 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        aria-label="Delete translation"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
