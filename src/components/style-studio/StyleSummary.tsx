"use client";

import { useEffect, useState } from "react";
import { useT } from "@/hooks/useT";
import { buildMusicPrompt, type LyricsPromptContext } from "@/lib/style-utils";
import type { StyleDraftPayload } from "@/lib/style-studio-constants";

export default function StyleSummary({
  payload,
  instrumental,
  lyricsCtx,
}: {
  payload: StyleDraftPayload;
  instrumental: boolean;
  lyricsCtx?: LyricsPromptContext;
}) {
  const t = useT();
  const summary = buildMusicPrompt(payload, instrumental, lyricsCtx);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
    } catch (error) {
      console.error("Copy failed", error);
    }
  }

  return (
    <section className=" border border-line bg-surface/80 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink/85">{t("melody.generatedPromptHeading")}</h3>
        <button
          type="button"
          onClick={copy}
          className=" border border-line bg-white/5 px-2.5 py-1 text-xs font-medium text-ink-muted transition hover:bg-white/10 hover:text-ink"
        >
          {copied ? t("melody.copied") : t("melody.copy")}
        </button>
      </div>
      <p className="text-sm leading-relaxed text-ink/85">{summary}</p>
      <p className="text-xs text-ink-dim">
        {t("melody.promptHint")}
      </p>
    </section>
  );
}
