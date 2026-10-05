"use client";

import { useT } from "@/hooks/useT";
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
  const t = useT();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink-muted">{t("lyricsStudio.translationReviewHeading")}</h3>
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-ink-dim hover:text-ink-muted transition-colors"
        >
          {t("lyricsStudio.backToEditor")}
        </button>
      </div>
      {blocks.map((block) => {
        const translated = translatedBlocks.get(block.id);
        if (!block.content.trim() || !translated?.trim()) return null;

        return (
          <div key={block.id} className=" border border-line bg-surface p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">{block.label}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold text-ink-dim mb-2">{t("lyricsStudio.originalLabel")}</p>
                <p className="text-sm leading-6 text-ink whitespace-pre-wrap">{block.content}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-ink-dim mb-2">{effectiveTranslationLanguage}</p>
                <p className="text-sm leading-6 text-ink whitespace-pre-wrap">{translated}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onUseTranslation(block.id, translated)}
                className="text-sm  border border-green-500/30 bg-green-500/10 px-3 py-2 text-green-200 hover:bg-green-500/20 transition-colors"
              >
                {t("lyricsStudio.useTranslationButton")}
              </button>
              <button
                type="button"
                onClick={() => onKeepOriginal(block.id)}
                className="text-sm  border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-blue-200 hover:bg-blue-500/20 transition-colors"
              >
                {t("lyricsStudio.keepOriginalButton")}
              </button>
              <button
                type="button"
                onClick={() => onKeepBoth(block.id, block.content, translated)}
                className="text-sm  border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-purple-200 hover:bg-purple-500/20 transition-colors"
              >
                {t("lyricsStudio.keepBothButton")}
              </button>
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={onDone}
        className="w-full  border border-line bg-white/5 px-3 py-2 text-sm text-ink-muted hover:bg-white/10 transition-colors"
      >
        {t("lyricsStudio.doneReviewingButton")}
      </button>
    </div>
  );
}
