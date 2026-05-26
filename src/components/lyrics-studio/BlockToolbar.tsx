"use client";

import type { BlockType } from "@/lib/lyrics-utils";

export default function BlockToolbar({
  blockTypes,
  blockLabels,
  blockColors,
  onAddBlock,
  onClearAll,
  onCopyAll,
  combinedLyrics,
  copied,
}: {
  blockTypes: BlockType[];
  blockLabels: Record<BlockType, string>;
  blockColors: Record<BlockType, string>;
  onAddBlock: (type: BlockType) => void;
  onClearAll: () => void;
  onCopyAll: () => void;
  combinedLyrics: string;
  copied: boolean;
}) {
  return (
    <section className="section-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">Add Block</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCopyAll}
            disabled={!combinedLyrics}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
            title="Combine + copy lyrics"
          >
            {copied ? "Copied!" : "Combine"}
          </button>
          <button
            type="button"
            onClick={onClearAll}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs text-red-200 transition hover:bg-red-500/20"
            title="Clear all lyric studio data"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {blockTypes.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onAddBlock(type)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/70 transition hover:border-primary-500/50 hover:bg-primary-500/10 hover:text-white"
          >
            <span
              className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: blockColors[type] }}
            />
            {blockLabels[type]}
          </button>
        ))}
      </div>
    </section>
  );
}
