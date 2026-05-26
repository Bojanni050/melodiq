"use client";

import type { BlockType } from "@/lib/lyrics-utils";

export default function PresetSelector({
  presets,
  activePreset,
  onApplyPreset,
}: {
  presets: Record<string, BlockType[]>;
  activePreset: string;
  onApplyPreset: (name: string) => void;
}) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-white/30">
        Presets
      </p>
      <div className="grid grid-cols-2 gap-2">
        {Object.keys(presets).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onApplyPreset(name)}
            className={`rounded-lg border px-3 py-2 text-sm transition hover:border-primary-500/50 hover:bg-primary-500/10 hover:text-white ${
              activePreset === name
                ? "border-primary-500/50 bg-primary-500/10 text-white"
                : "border-white/10 bg-white/5 text-white/70"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
