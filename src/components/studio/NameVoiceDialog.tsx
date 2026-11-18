"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/hooks/useT";

const MAX_NAME_LENGTH = 120;

interface NameVoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** The voice being (re)named — null while no completed voice exists. */
  voice: { id: string; name: string | null } | null;
  /** Receives the updated voice row so the caller can refresh its list. */
  onSaved: (voice: { id: string; name: string | null }) => void;
}

/**
 * Names or renames a cloned voice from the Studio — the fallback for voices
 * that were left unnamed when they were created (e.g. "Skip for now" in the
 * track's Create Voice dialog, or a direct Studio upload).
 *
 * This only patches the local label; APIMart keeps its own persona id.
 */
export default function NameVoiceDialog({ isOpen, onClose, voice, onSaved }: NameVoiceDialogProps) {
  const t = useT();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Prefill on every opening so renaming starts from the current label.
  useEffect(() => {
    if (!isOpen) return;
    setName(voice?.name ?? "");
    setError(null);
    nameInputRef.current?.focus();
  }, [isOpen, voice]);

  const handleSave = useCallback(async () => {
    if (!voice) return;
    const trimmed = name.trim();
    if (!trimmed) {
      nameInputRef.current?.focus();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/voice/${voice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.voice) {
        setError(data.error || t("studio.nameVoiceFailed"));
        return;
      }
      onSaved(data.voice);
      onClose();
    } catch {
      setError(t("studio.nameVoiceFailed"));
    } finally {
      setSaving(false);
    }
  }, [name, onClose, onSaved, t, voice]);

  if (!isOpen || !voice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("studio.nameVoiceTitle")}
        className="relative w-full max-w-[420px] border border-line bg-surface p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-ink">{t("studio.nameVoiceTitle")}</h3>
        <p className="mt-2 text-sm text-ink-muted">{t("studio.voiceNameHint")}</p>

        <input
          ref={nameInputRef}
          type="text"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSave();
          }}
          placeholder={t("studio.voiceNamePlaceholder")}
          aria-label={t("studio.voiceNameLabel")}
          className="mt-4 w-full border border-line bg-black/30 px-3 py-2 text-sm text-ink placeholder:text-ink-dim focus:border-white/30 focus:outline-none"
        />

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-full bg-white/8 px-4 text-sm font-medium text-ink-muted transition-colors hover:bg-white/14"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !name.trim()}
            className="h-10 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {saving ? t("common.saving") : t("studio.saveVoiceName")}
          </button>
        </div>
      </div>
    </div>
  );
}
