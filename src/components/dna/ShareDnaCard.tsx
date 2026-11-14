"use client";

import { useEffect, useMemo, useState } from "react";
import { CARD_HEIGHT, CARD_WIDTH, buildDnaCardSvg } from "@/lib/dna/card";
import type { HelixTraitInput } from "@/lib/dna/helix";
import { useT } from "@/hooks/useT";

type Props = {
  name: string;
  summary: string;
  statsLine: string;
  stageLabel: string;
  traits: HelixTraitInput[];
};

/**
 * Opens a preview of the share card and rasterises it to PNG in the browser.
 * The card is built from the traits already on screen, so what you share is
 * what you see — no second source of truth.
 */
export default function ShareDnaCard({ name, summary, statsLine, stageLabel, traits }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const svg = useMemo(
    () => buildDnaCardSvg({ name, summary, statsLine, stageLabel, traits }),
    [name, summary, statsLine, stageLabel, traits]
  );
  const svgUrl = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, [svg]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const download = async () => {
    setSaving(true);
    setError(null);
    try {
      const image = new Image();
      const loaded = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("card image failed"));
      });
      image.src = svgUrl;
      await loaded;

      const canvas = document.createElement("canvas");
      canvas.width = CARD_WIDTH;
      canvas.height = CARD_HEIGHT;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas unavailable");
      context.drawImage(image, 0, 0, CARD_WIDTH, CARD_HEIGHT);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("png encoding failed");

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "melody-dna.png";
      link.click();
      // Revoking straight away breaks the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      setError(t("dna.shareFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-white/5 px-4 text-sm font-medium text-ink transition-colors hover:bg-white/10"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
          />
        </svg>
        {t("dna.shareOpen")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t("dna.shareTitle")}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-3xl border border-line bg-surface"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
              <div>
                <h2 className="text-sm font-medium">{t("dna.shareTitle")}</h2>
                <p className="mt-0.5 text-xs text-ink-dim">{t("dna.shareHint")}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 text-ink-dim transition-colors hover:text-ink"
                aria-label={t("dna.shareClose")}
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={svgUrl}
                alt={t("dna.shareTitle")}
                width={CARD_WIDTH}
                height={CARD_HEIGHT}
                className="w-full border border-line bg-canvas"
              />
              {error && <p className="mt-3 text-xs text-amber-400/90">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 items-center rounded-full border border-line px-4 text-sm text-ink-muted transition-colors hover:bg-white/5"
              >
                {t("dna.shareClose")}
              </button>
              <button
                type="button"
                onClick={download}
                disabled={saving}
                className="inline-flex h-9 items-center rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? t("dna.shareSaving") : t("dna.shareDownload")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
