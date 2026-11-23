"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { notifyVoicesChanged } from "@/lib/voice-sync";

/**
 * Only the identity of a finished track is needed, so the dialog accepts the
 * player's track snapshot as well as a full list row.
 */
export interface VoiceSourceTrack {
  id: string;
  title?: string | null;
}

const POLL_INTERVAL_MS = 4000;

// Mirrors the limits the routes enforce, so the fields cannot grow past what
// the `cloned_voices` columns hold.
const MAX_NAME_LENGTH = 120;
const MAX_STYLES_LENGTH = 200;
const MAX_DESCRIBE_LENGTH = 1000;

type Phase = "form" | "starting" | "waiting" | "done" | "error";

interface CreateVoiceFromTrackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  track: VoiceSourceTrack;
}

/**
 * Clones the voice out of a finished track through APIMart.
 *
 * The name, styles and description are asked for *before* submitting, because
 * APIMart stores them on the persona at creation time — renaming afterwards
 * only changes the local label. A track APIMart generated itself goes through
 * the persona endpoint, which takes all three; anything else is sent as an
 * audio URL through createVoice, which takes none of them, so there they are
 * only kept as labels in MelodIQ.
 */
export default function CreateVoiceFromTrackDialog({
  isOpen,
  onClose,
  track,
}: CreateVoiceFromTrackDialogProps) {
  const [phase, setPhase] = useState<Phase>("form");
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [styles, setStyles] = useState("");
  const [describe, setDescribe] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  // The form must be reset once per opening, not on every re-render.
  const openedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (openedForRef.current === track.id) return;
    openedForRef.current = track.id;
    setName(track.title?.trim() ?? "");
    setStyles("");
    setDescribe("");
    setVoiceId(null);
    setError(null);
    setPhase("form");
    nameInputRef.current?.focus();
  }, [isOpen, track.id, track.title]);

  const start = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      nameInputRef.current?.focus();
      return;
    }

    setPhase("starting");
    setError(null);

    try {
      const res = await fetch("/api/voice/from-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: track.id,
          name: trimmedName,
          styles: styles.trim(),
          describe: describe.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.voice) {
        setError(data.error || "Could not start voice cloning");
        setPhase("error");
        return;
      }
      setVoiceId(data.voice.id);
      setPhase("waiting");
      // The Studio's picker can be mounted behind the player; let it refetch
      // so the new (pending) voice shows up right away.
      notifyVoicesChanged();
    } catch {
      setError("Could not start voice cloning");
      setPhase("error");
    }
  }, [describe, name, styles, track.id]);

  // APIMart reports completion through the voice row, so poll it while the
  // dialog is open — the Studio's own poller only runs on its own page.
  //
  // The poll has to keep itself alive: a one-shot timeout dies the moment the
  // task is still pending, because nothing in the effect's dependencies
  // changes then. An interval keeps firing until the phase flips.
  useEffect(() => {
    if (!isOpen || phase !== "waiting" || !voiceId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/voice/status/${voiceId}`);
        if (cancelled) return;
        if (!res.ok) {
          setError("Could not check the voice status");
          setPhase("error");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (!data.voice) {
          setError("Could not check the voice status");
          setPhase("error");
          return;
        }
        if (data.voice.status === "completed") {
          notifyVoicesChanged();
          setPhase("done");
        } else if (data.voice.status === "failed") {
          notifyVoicesChanged();
          setError(data.voice.error || "Voice cloning failed");
          setPhase("error");
        }
      } catch {
        // Keep waiting; a single failed poll says nothing about the task.
      }
    };

    const timer = setInterval(() => void poll(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isOpen, phase, voiceId]);

  const handleClose = useCallback(() => {
    openedForRef.current = null;
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const trackTitle = track.title || "Untitled";
  const fieldClass =
    "mt-1.5 w-full border border-line bg-black/30 px-3 py-2 text-sm text-ink placeholder:text-ink-dim focus:border-white/30 focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={handleClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create voice from track"
        className="relative w-full max-w-[420px] border border-line bg-surface p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-ink">Create voice from this track</h3>

        {phase === "form" && (
          <>
            <p className="mt-2 text-sm text-ink-muted">
              The voice is taken from &ldquo;{trackTitle}&rdquo;. Name it now — the name and
              descriptors are stored on the voice itself, so renaming later only changes how it
              shows up here.
            </p>

            <label className="mt-4 block text-xs font-medium text-ink-dim">
              Voice name
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Warm male baritone"
                className={fieldClass}
              />
            </label>

            <label className="mt-3 block text-xs font-medium text-ink-dim">
              Styles <span className="font-normal">(optional)</span>
              <input
                type="text"
                value={styles}
                maxLength={MAX_STYLES_LENGTH}
                onChange={(e) => setStyles(e.target.value)}
                placeholder="e.g. soul, warm baritone"
                className={fieldClass}
              />
            </label>

            <label className="mt-3 block text-xs font-medium text-ink-dim">
              Description <span className="font-normal">(optional)</span>
              <textarea
                value={describe}
                maxLength={MAX_DESCRIBE_LENGTH}
                onChange={(e) => setDescribe(e.target.value)}
                rows={3}
                placeholder="Anything worth remembering about this voice"
                className={`${fieldClass} resize-none`}
              />
            </label>
          </>
        )}

        {(phase === "starting" || phase === "waiting") && (
          <>
            <p className="mt-2 text-sm text-ink-muted">
              Extracting the voice from &ldquo;{trackTitle}&rdquo;. This usually takes a minute or
              two — you can close this and use the voice as soon as it shows up in the Studio.
            </p>
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/8">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-white/40" />
            </div>
          </>
        )}

        {phase === "done" && (
          <p className="mt-2 text-sm text-ink-muted">
            &ldquo;{name.trim() || trackTitle}&rdquo; is ready. Pick it in the Studio&rsquo;s voice
            menu to sing with it.
          </p>
        )}

        {phase === "error" && <p className="mt-2 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          {phase === "form" ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="h-10 rounded-full bg-white/8 px-4 text-sm font-medium text-ink-muted transition-colors hover:bg-white/14"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void start()}
                disabled={!name.trim()}
                className="h-10 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-accent-strong disabled:opacity-50"
              >
                Create voice
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="h-10 rounded-full bg-white/8 px-4 text-sm font-medium text-ink-muted transition-colors hover:bg-white/14"
            >
              {phase === "starting" || phase === "waiting" ? "Close — keep cloning" : "Close"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
