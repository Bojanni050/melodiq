"use client";

import { useDnaHint } from "@/hooks/useDnaHint";
import { useT } from "@/hooks/useT";
import { DNA_HINT_PREFIX, DNA_STRENGTHS, type DnaStrength } from "@/lib/dna/context";
import { useStudioStore } from "@/lib/stores/studioStore";

const LABEL_KEY: Record<DnaStrength, "studio.dnaOff" | "studio.dnaSubtle" | "studio.dnaStrong"> = {
  off: "studio.dnaOff",
  subtle: "studio.dnaSubtle",
  strong: "studio.dnaStrong",
};

const DESC_KEY: Record<DnaStrength, "studio.dnaDescOff" | "studio.dnaDescSubtle" | "studio.dnaDescStrong"> = {
  off: "studio.dnaDescOff",
  subtle: "studio.dnaDescSubtle",
  strong: "studio.dnaDescStrong",
};

/**
 * Melody DNA switch shared by Studio and Melody, both reading the same
 * persisted studioStore value. The hint line below is a live preview of what
 * /api/generate appends; the style prompt itself stays untouched so the char
 * counter, Reuse Prompt and copy/paste never end up with a duplicated hint.
 */
export default function DnaInfluenceControl({ className = "" }: { className?: string }) {
  const t = useT();
  const dnaInfluence = useStudioStore((s) => s.dnaInfluence);
  const setDnaInfluence = useStudioStore((s) => s.setDnaInfluence);
  const hint = useDnaHint(dnaInfluence);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-ink-dim">{t("studio.dnaLabel")}</span>
        <div className="flex gap-1.5">
          {DNA_STRENGTHS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setDnaInfluence(level)}
              aria-pressed={dnaInfluence === level}
              className={`px-2.5 py-1 text-[11px] font-medium transition-colors border ${
                dnaInfluence === level
                  ? "bg-accent/15 text-accent border-accent/40"
                  : "bg-white/5 text-ink-dim border-line hover:bg-white/10"
              }`}
            >
              {t(LABEL_KEY[level])}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-ink-dim mt-1">{t(DESC_KEY[dnaInfluence])}</p>

      {dnaInfluence !== "off" && (
        <div className="mt-2 border border-line bg-white/5 px-2.5 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-ink-dim">{t("studio.dnaPreviewLabel")}</p>
          {hint.loading && !hint.text ? (
            <p className="text-[11px] text-ink-dim">…</p>
          ) : hint.text ? (
            <p className="text-[11px] leading-snug text-ink-muted break-words">
              <span className="text-ink-dim">{DNA_HINT_PREFIX}</span>
              {hint.text}
            </p>
          ) : (
            <p className="text-[11px] text-ink-dim">{t("studio.dnaPreviewEmpty")}</p>
          )}
        </div>
      )}
    </div>
  );
}
