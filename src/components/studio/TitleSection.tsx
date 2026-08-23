"use client";

import { useT } from "@/hooks/useT";

export default function TitleSection({
  title,
  setTitle,
  instrumental,
  lyrics,
  generatingTitle,
  onGenerateTitle,
}: {
  title: string;
  setTitle: (v: string) => void;
  instrumental: boolean;
  lyrics: string;
  generatingTitle: boolean;
  onGenerateTitle: () => void;
}) {
  const t = useT();
  const titleCharCount = title.length;
  const titleMaxChars = 120;

  return (
    <section className="section-card">
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-semibold text-white/80">{t("studio.songTitleLabel")}</label>
        {!instrumental && !title.trim() && lyrics.trim() && (
          <button
            onClick={onGenerateTitle}
            disabled={generatingTitle || !lyrics.trim()}
            className="btn-ghost text-sm flex items-center gap-1.5"
          >
            {generatingTitle ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            {generatingTitle ? t("studio.generating") : t("studio.generateTitle")}
          </button>
        )}
      </div>
      <div className="relative">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("studio.titlePlaceholder")}
          className="input-field text-sm pr-16"
          maxLength={titleMaxChars}
        />
        <span className={`absolute bottom-3 right-3 text-xs ${titleCharCount > titleMaxChars * 0.9 ? "text-red-400" : "text-white/20"}`}>
          {titleCharCount}/{titleMaxChars}
        </span>
      </div>
      {!title.trim() && (
        <p className="text-xs text-white/40 mt-1">
          {t("studio.titleOptionalHint")}
        </p>
      )}
    </section>
  );
}
