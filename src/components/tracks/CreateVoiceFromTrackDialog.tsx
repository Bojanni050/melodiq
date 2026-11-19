"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Only the identity of a finished track is needed, so the dialog accepts the
 * player's track snapshot as well as a full list row.
 */
export interface VoiceSourceTrack {
  id: string;
  title?: string | null;
}

const POLL_INTERVAL_MS = 4000;
const MAX_NAME_LENGTH = 120;

type Phase = "starting" | "waiting" | "naming" | "error";

interface CreateVoiceFromTrackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  track: VoiceSourceTrack;
}

/**
 * Clones the voice out of a finished track through APIMart and asks for a name
 * as soon as the persona exists.
 *
 * The name is asked for here rather than in the Studio because this is the
 * moment the user knows which track the voice came from; leaving it unnamed
 * would leave every clone as an anonymous row in the Studio's voice toggle.
 * APIMart extracts the voice asynchronously, so the dialog opens on the
 * submission and swaps its spinner for the name field when the task lands.
 */
export default function CreateVoiceFromTrackDialog({
  isOpen,
  onClose,
  track,
}: CreateVoiceFromTrackDialogProps) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  // The submission must fire once per opening, not on every re-render.
  const startedForRef = useRef<string | null>(null);

  const start = useCallback(async () => {
    setPhase("starting");
    setError(null);
    setVoiceId(null);
    setName("");

    try {
      const res = await fetch("/api/voice/from-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: track.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.voice) {
        setError(data.error || "Could not start voice cloning");
        setPhase("error");
        return;
      }
      setVoiceId(data.voice.id);
      setPhase("waiting");
    } catch {
      setError("Could not start voice cloning");
      setPhase("error");
    }
  }, [track.id]);

  useEffect(() => {
    if (!isOpen) return;
    if (startedForRef.current === track.id) return;
    startedForRef.current = track.id;
    void start();
  }, [isOpen, track.id, start]);

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
          setPhase("naming");
        } else if (data.voice.status === "failed") {
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

  useEffect(() => {
    if (phase === "naming") nameInputRef.current?.focus();
  }, [phase]);

  const handleClose = useCallback(() => {
    startedForRef.current = null;
    onClose();
  }, [onClose]);

  const handleSave = useCallback(async () => {
    if (!voiceId) return;
    const trimmed = name.trim();
    if (!trimmed) {
      nameInputRef.current?.focus();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/voice/${voiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save the name");
        return;
      }
      handleClose();
    } catch {
      setError("Could not save the name");
    } finally {
      setSaving(false);
    }
  }, [handleClose, name, voiceId]);

  if (!isOpen) return null;

  const trackTitle = track.title || "Untitled";

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

        {(phase === "starting" || phase === "waiting") && (
          <>
            <p className="mt-2 text-sm text-ink-muted">
              Extracting the voice from &ldquo;{trackTitle}&rdquo;. This usually takes a minute or
              two — you can keep this open, or close it and name the voice later in the Studio.
            </p>
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/8">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-white/40" />
            </div>
          </>
        )}

        {phase === "naming" && (
          <>
            <p className="mt-2 text-sm text-ink-muted">
              The voice from &ldquo;{trackTitle}&rdquo; is ready. Give it a name so you can pick it
              in the Studio.
            </p>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSave();
              }}
              placeholder="e.g. Warm male baritone"
              aria-label="Voice name"
              className="mt-4 w-full border border-line bg-black/30 px-3 py-2 text-sm text-ink placeholder:text-ink-dim focus:border-white/30 focus:outline-none"
            />
          </>
        )}

        {phase === "error" && <p className="mt-2 text-sm text-red-400">{error}</p>}
        {phase === "naming" && error && <p className="mt-2 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          {phase === "naming" ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="h-10 rounded-full bg-white/8 px-4 text-sm font-medium text-ink-muted transition-colors hover:bg-white/14"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !name.trim()}
                className="h-10 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-accent-strong disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save name"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="h-10 rounded-full bg-white/8 px-4 text-sm font-medium text-ink-muted transition-colors hover:bg-white/14"
            >
              {phase === "error" ? "Close" : "Close — name it later"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
