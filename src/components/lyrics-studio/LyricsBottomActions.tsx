"use client";

import Flowchart from "@/components/Flowchart";
import { TRANSLATION_LANGUAGES } from "@/lib/lyrics-studio-constants";
import type { LyricBlock } from "@/lib/lyrics-utils";

type LyricsBottomActionsProps = {
  blocks: LyricBlock[];
  translationLanguage: string;
  customTranslationLanguage: string;
  translatingLyrics: boolean;
  combinedLyrics: string;
  copied: boolean;
  onTranslationLanguageChange: (value: string) => void;
  onCustomTranslationLanguageChange: (value: string) => void;
  onTranslateAllLyrics: () => void;
  onCopyAllLyrics: () => void;
  onUseInStudio: () => void;
};

export default function LyricsBottomActions({
  blocks,
  translationLanguage,
  customTranslationLanguage,
  translatingLyrics,
  combinedLyrics,
  copied,
  onTranslationLanguageChange,
  onCustomTranslationLanguageChange,
  onTranslateAllLyrics,
  onCopyAllLyrics,
  onUseInStudio,
}: LyricsBottomActionsProps) {
  return (
    <>
      <div className="block xl:hidden">
        <Flowchart blocks={blocks.map((block) => ({ label: block.label, type: block.type }))} />
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
        <div className="flex flex-1 flex-col gap-2 sm:max-w-[280px]">
          <select
            value={translationLanguage}
            onChange={(event) => onTranslationLanguageChange(event.target.value)}
            aria-label="Doeltaal voor vertaling"
            className="select-field w-full text-sm"
          >
            {TRANSLATION_LANGUAGES.map((item) => (
              <option key={item.value} value={item.value} className="bg-gray-900">
                {item.label}
              </option>
            ))}
          </select>
          {translationLanguage === "other" && (
            <input
              type="text"
              value={customTranslationLanguage}
              onChange={(event) => onCustomTranslationLanguageChange(event.target.value)}
              placeholder="Doeltaal, bv. Swedish"
              className="input-field text-sm"
            />
          )}
        </div>
        <button
          type="button"
          onClick={onTranslateAllLyrics}
          disabled={
            !combinedLyrics.trim() ||
            translatingLyrics ||
            (translationLanguage === "other" && !customTranslationLanguage.trim())
          }
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          title="Vertaal alle lyric blokken naar de gekozen taal"
        >
          {translatingLyrics ? "Vertalen..." : "Translate lyrics"}
        </button>
        <button
          type="button"
          onClick={onCopyAllLyrics}
          disabled={!combinedLyrics}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
        >
          {copied ? "Copied!" : "Copy all lyrics"}
        </button>
        <button
          type="button"
          onClick={onUseInStudio}
          disabled={!combinedLyrics}
          className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-35"
        >
          Use in Studio &rarr;
        </button>
      </div>
    </>
  );
}
