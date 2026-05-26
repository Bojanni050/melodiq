"use client";

import type { LyricBlock } from "@/lib/lyrics-utils";

export default function TranslationReview({
  blocks,
  translatedBlocks,
  effectiveTranslationLanguage,
  onUseTranslation,
  onKeepOriginal,
  onKeepBoth,
  onDone,
}: {
  blocks: LyricBlock[];
  translatedBlocks: Map<string, string>;
  effectiveTranslationLanguage: string;
  onUseTranslation: (blockId: string, translated: string) => void;
  onKeepOriginal: (blockId: string) => void;
  onKeepBoth: (blockId: string, original: string, translated: string) => void;
  onDone: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white/80">Translation Review</h3>
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          {"<- Back to editor"}
        </button>
      </div>
      {blocks.map((block) => {
        const translated = translatedBlocks.get(block.id);
        if (!block.content.trim() || !translated?.trim()) return null;

        return (
          <div key={block.id} className="rounded-xl border border-white/10 bg-[#15151f] p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-3">{block.label}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold text-white/40 mb-2">Original</p>
                <p className="text-sm leading-6 text-white/90 whitespace-pre-wrap">{block.content}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-white/40 mb-2">{effectiveTranslationLanguage}</p>
                <p className="text-sm leading-6 text-white/90 whitespace-pre-wrap">{translated}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onUseTranslation(block.id, translated)}
                className="text-xs rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-green-200 hover:bg-green-500/20 transition-colors"
              >
                ✓ Use translation
              </button>
              <button
                type="button"
                onClick={() => onKeepOriginal(block.id)}
                className="text-xs rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-blue-200 hover:bg-blue-500/20 transition-colors"
              >
                ✓ Keep original
              </button>
              <button
                type="button"
                onClick={() => onKeepBoth(block.id, block.content, translated)}
                className="text-xs rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-purple-200 hover:bg-purple-500/20 transition-colors"
              >
                ✓ Keep both
              </button>
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={onDone}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60 hover:bg-white/10 transition-colors"
      >
        Done reviewing translations
      </button>
    </div>
  );
}
