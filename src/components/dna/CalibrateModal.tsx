"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useT } from "@/hooks/useT";

type Card = {
  id: string;
  text: string;
  audioUrl: string;
  duration: number | null;
  value: number;
};

type Pair = { traitKey: string; left: Card; right: Card };

type CalibrationState = {
  pair: Pair | null;
  answered: number;
  total: number;
  reason: "done" | "no_profile" | "no_pairs" | null;
};

type Choice = "left" | "right" | "neither";

type Props = {
  open: boolean;
  /** Which alias profile the duels are for ('' = account-wide). */
  alias: string;
  /** `changed` is true when at least one answer was saved, so the page can refresh the profile. */
  onClose: (changed: boolean) => void;
};

/** How much of a song a preview plays. */
const PREVIEW_SECONDS = 10;
/** Horizontal drag, in px, that counts as a swipe. */
const SWIPE_DISTANCE = 60;

/**
 * Calibration duels: two of the user's songs, one trait, "which is more you?".
 * The answer is posted to /api/dna/calibrate, which turns it into a normal
 * feedback event and hands back the next pair, so this component holds no
 * scoring logic of its own.
 */
export default function CalibrateModal({ open, alias, onClose }: Props) {
  const t = useT();
  const [state, setState] = useState<CalibrationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const changed = useRef(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeStart = useRef<number | null>(null);
  const dialog = useRef<HTMLDivElement | null>(null);

  const stopPreview = useCallback(() => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    audio.current?.pause();
    setPlayingId(null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = alias ? `?alias=${encodeURIComponent(alias)}` : "";
      const res = await fetch(`/api/dna/calibrate${query}`);
      if (!res.ok) throw new Error("load failed");
      setState((await res.json()) as CalibrationState);
    } catch {
      setError(t("dna.calibrateLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [alias, t]);

  useEffect(() => {
    if (!open) return;
    changed.current = false;
    setState(null);
    void load();
    dialog.current?.focus();
    return () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      audio.current?.pause();
    };
  }, [open, load]);

  const close = useCallback(() => {
    stopPreview();
    onClose(changed.current);
  }, [onClose, stopPreview]);

  const answer = useCallback(
    async (choice: Choice) => {
      const pair = state?.pair;
      if (!pair || saving) return;
      stopPreview();
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/dna/calibrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            traitKey: pair.traitKey,
            leftId: pair.left.id,
            rightId: pair.right.id,
            choice,
            alias,
          }),
        });
        if (!res.ok) throw new Error("save failed");
        changed.current = true;
        setState((await res.json()) as CalibrationState);
      } catch {
        setError(t("dna.calibrateSaveFailed"));
      } finally {
        setSaving(false);
      }
    },
    [alias, saving, state, stopPreview, t]
  );

  const togglePreview = (card: Card) => {
    if (playingId === card.id) {
      stopPreview();
      return;
    }
    stopPreview();
    const element = audio.current ?? new Audio();
    audio.current = element;
    element.src = card.audioUrl;
    // Start a third of the way in: intros are rarely what makes a song "you".
    const start = card.duration && card.duration > PREVIEW_SECONDS * 2 ? Math.floor(card.duration / 3) : 0;
    element.currentTime = start;
    void element
      .play()
      .then(() => {
        setPlayingId(card.id);
        stopTimer.current = setTimeout(stopPreview, PREVIEW_SECONDS * 1000);
      })
      .catch(() => setPlayingId(null));
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowLeft") void answer("left");
      else if (event.key === "ArrowRight") void answer("right");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, answer]);

  if (!open) return null;

  const pair = state?.pair ?? null;
  const progress = state ? Math.round((state.answered / state.total) * 100) : 0;
  const question = pair?.traitKey === "energy" ? t("dna.calibrateQuestionEnergy") : t("dna.calibrateQuestionTempo");

  const formatValue = (traitKey: string, value: number) =>
    traitKey === "energy"
      ? t("dna.calibrateEnergyValue", { value: Math.round(value) })
      : `${Math.round(value)} BPM`;

  const renderCard = (card: Card, side: "left" | "right", traitKey: string) => (
    <div className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-white/5 p-4 transition-colors focus-within:border-accent/60 hover:border-accent/40">
      <button
        type="button"
        onClick={() => void answer(side)}
        disabled={saving}
        className="flex flex-1 flex-col gap-3 text-left outline-none disabled:cursor-not-allowed"
        aria-label={`${side === "left" ? "←" : "→"} ${card.text}, ${formatValue(traitKey, card.value)}`}
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-dim">
          <span aria-hidden>{side === "left" ? "←" : "→"}</span>
          {formatValue(traitKey, card.value)}
        </span>
        <span className="text-base font-semibold leading-snug text-ink">{card.text}</span>
      </button>
      <button
        type="button"
        onClick={() => togglePreview(card)}
        aria-pressed={playingId === card.id}
        className="inline-flex h-9 w-fit items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold text-ink transition-colors hover:bg-white/15"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          {playingId === card.id ? (
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
          ) : (
            <path d="M8 5v14l11-7z" />
          )}
        </svg>
        {playingId === card.id ? t("dna.calibratePause") : t("dna.calibratePlay")}
      </button>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dna-calibrate-title"
        tabIndex={-1}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-canvas shadow-2xl outline-none"
      >
        <header className="flex items-center gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">{t("dna.calibrateEyebrow")}</p>
            <h2 id="dna-calibrate-title" className="text-base font-semibold text-ink">
              {t("dna.calibrateTitle")}
            </h2>
          </div>
          {state ? (
            <div className="w-40 shrink-0">
              <p className="text-right text-xs font-semibold tabular-nums text-ink">
                {state.answered}/{state.total}
              </p>
              <div
                className="mt-1 h-1 w-full bg-white/10"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={state.total}
                aria-valuenow={state.answered}
              >
                <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={close}
            aria-label={t("dna.calibrateClose")}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-white/10"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div
          className="px-6 py-5"
          onPointerDown={(event) => {
            swipeStart.current = event.clientX;
          }}
          onPointerUp={(event) => {
            const start = swipeStart.current;
            swipeStart.current = null;
            if (start === null || !pair) return;
            const delta = event.clientX - start;
            if (delta <= -SWIPE_DISTANCE) void answer("left");
            else if (delta >= SWIPE_DISTANCE) void answer("right");
          }}
        >
          {loading && !state ? (
            <p className="py-10 text-center text-sm text-ink-muted">{t("dna.calibrateLoading")}</p>
          ) : pair ? (
            <>
              <p className="mb-4 text-center text-sm font-semibold text-ink-muted">{question}</p>
              <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
                {renderCard(pair.left, "left", pair.traitKey)}
                {renderCard(pair.right, "right", pair.traitKey)}
              </div>
            </>
          ) : state ? (
            <div className="py-10 text-center">
              {state.reason === "done" ? (
                <>
                  <p className="text-sm font-semibold text-ink">{t("dna.calibrateDoneTitle")}</p>
                  <p className="mt-1 text-sm text-ink-muted">{t("dna.calibrateDoneBody", { total: state.total })}</p>
                </>
              ) : (
                <p className="text-sm text-ink-muted">
                  {state.reason === "no_profile" ? t("dna.calibrateNoProfile") : t("dna.calibrateNoPairs")}
                </p>
              )}
            </div>
          ) : null}

          {error ? <p className="mt-4 text-center text-sm text-amber-400/90">{error}</p> : null}
        </div>

        {pair ? (
          <footer className="flex items-center justify-between gap-3 border-t border-line px-6 py-3">
            <p className="text-xs text-ink-dim">{t("dna.calibrateHint")}</p>
            <button
              type="button"
              onClick={() => void answer("neither")}
              disabled={saving}
              className="inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold text-ink-muted transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              {t("dna.calibrateNeither")}
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
