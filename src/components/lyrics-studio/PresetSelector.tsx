"use client";

import { useT } from "@/hooks/useT";
import { BLOCK_PRESETS } from "@/lib/lyrics-studio-constants";
import type { BlockType } from "@/lib/lyrics-utils";

export default function PresetSelector({
  presets,
  activePreset,
  onApplyPreset,
  onDeletePreset,
}: {
  presets: Record<string, BlockType[]>;
  activePreset: string;
  onApplyPreset: (name: string) => void;
  onDeletePreset?: (name: string) => void;
}) {
  const t = useT();
  const defaultPresetKeys = new Set(Object.keys(BLOCK_PRESETS));

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-ink-dim">
        {t("lyricsStudio.presetsLabel")}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {Object.keys(presets).map((name) => {
          const isCustom = !defaultPresetKeys.has(name);
          return (
            <div key={name} className="relative group/preset">
              <button
                type="button"
                onClick={() => onApplyPreset(name)}
                className={`w-full  border px-3 py-2 text-sm transition text-left hover:border-accent/50 hover:bg-accent/10 hover:text-ink ${
                  isCustom ? "pr-8" : ""
                } ${
                  activePreset === name
                    ? "border-accent/50 bg-accent/10 text-ink font-medium"
                    : "border-line bg-white/5 text-ink-muted"
                }`}
              >
                <span className="block truncate">{name}</span>
              </button>
              {isCustom && onDeletePreset && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDeletePreset(name);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-dim hover:bg-red-500/20 hover:text-red-400 transition"
                  title={t("lyricsStudio.deletePresetTooltip")}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
