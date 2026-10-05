"use client";

import { useT } from "@/hooks/useT";
import { TRANSLATION_LANGUAGES } from "@/lib/lyrics-studio-constants";

type LyricsBottomActionsProps = {
  translationLanguage: string;
  customTranslationLanguage: string;
  combinedLyrics: string;
  onTranslationLanguageChange: (value: string) => void;
  onCustomTranslationLanguageChange: (value: string) => void;
  onGoToMusic: () => void;
  onGoToMelody: () => void;
};

export default function LyricsBottomActions({
  translationLanguage,
  customTranslationLanguage,
  combinedLyrics,
  onTranslationLanguageChange,
  onCustomTranslationLanguageChange,
  onGoToMusic,
  onGoToMelody,
}: LyricsBottomActionsProps) {
  const t = useT();
  return (
    <>
      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <div className="flex flex-1 flex-col gap-2 sm:max-w-[280px]">
          <select
            value={translationLanguage}
            onChange={(event) => onTranslationLanguageChange(event.target.value)}
            aria-label={t("lyricsStudio.targetLanguageAriaLabel")}
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
              placeholder={t("lyricsStudio.targetLanguagePlaceholder")}
              className="input-field text-sm"
            />
          )}
        </div>
        <button
          type="button"
          onClick={onGoToMelody}
          disabled={!combinedLyrics.trim()}
          className=" border border-line bg-white/5 px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-white/10 hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
        >
          {t("lyricsStudio.goToMelody")}
        </button>
        <button
          type="button"
          onClick={onGoToMusic}
          disabled={!combinedLyrics.trim()}
          className=" bg-accent px-4 py-2 text-sm font-semibold text-ink transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-35"
        >
          {t("lyricsStudio.goToMusic")} &rarr;
        </button>
      </div>
    </>
  );
}
