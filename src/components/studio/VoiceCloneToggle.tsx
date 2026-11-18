"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStudioStore } from "@/lib/store";
import { useT } from "@/hooks/useT";
import NameVoiceDialog from "./NameVoiceDialog";

interface ClonedVoice {
  id: string;
  status: "pending" | "completed" | "failed";
  personaId: string | null;
  /** Label the user gave it, e.g. when cloning a track from its action menu. */
  name: string | null;
  error: string | null;
  createdAt: string;
}

const POLL_INTERVAL_MS = 4000;

export default function VoiceCloneToggle() {
  const t = useT();
  const usePersonaVoice = useStudioStore((s) => s.usePersonaVoice);
  const setUsePersonaVoice = useStudioStore((s) => s.setUsePersonaVoice);

  const [voices, setVoices] = useState<ClonedVoice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchVoices = useCallback(async () => {
    try {
      const res = await fetch("/api/voice");
      if (!res.ok) return;
      const data = await res.json();
      setVoices(data.voices ?? []);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void fetchVoices();
  }, [fetchVoices]);

  const activeVoice = voices[0];
  const completedVoice = voices.find((v) => v.status === "completed");

  useEffect(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (!activeVoice || activeVoice.status !== "pending") return;

    pollTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/voice/status/${activeVoice.id}`);
        if (res.ok) {
          const data = await res.json();
          setVoices((prev) => prev.map((v) => (v.id === data.voice.id ? data.voice : v)));
        }
      } catch {}
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [activeVoice]);

  useEffect(() => {
    if (!completedVoice && usePersonaVoice) setUsePersonaVoice(false);
  }, [completedVoice, usePersonaVoice, setUsePersonaVoice]);

  const handleFileSelected = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("audio", file);
      const res = await fetch("/api/voice/create", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("studio.voiceCloningFailedGeneric"));
        return;
      }
      setVoices((prev) => [data.voice, ...prev]);
    } catch {
      setError(t("account.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }, [t]);

  return (
    <div className="mb-4 p-3  bg-white/5 border border-line">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-medium text-ink-muted">
              {completedVoice?.name || t("studio.myClonedVoice")}
            </p>
            {completedVoice &&
              (completedVoice.name ? (
                <button
                  type="button"
                  onClick={() => setShowNameDialog(true)}
                  aria-label={t("studio.renameVoice")}
                  title={t("studio.renameVoice")}
                  className="shrink-0 text-ink-dim transition-colors hover:text-ink-muted"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                    />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNameDialog(true)}
                  className="shrink-0 text-[10px] text-accent hover:underline"
                >
                  {t("studio.nameThisVoice")}
                </button>
              ))}
          </div>
          <p className="text-[10px] text-ink-dim mt-0.5">
            {!loaded && t("library.loading")}
            {loaded && !activeVoice && t("studio.noVoiceUploadedYet")}
            {loaded && activeVoice?.status === "pending" && t("studio.voiceCloningInProgress")}
            {loaded && activeVoice?.status === "failed" && (activeVoice.error || t("studio.cloningFailed"))}
            {loaded && completedVoice && t("studio.voiceReadyToUse")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-sm px-3 py-1.5  bg-accent/20 text-accent hover:bg-accent/30 transition-colors disabled:opacity-50"
        >
          {uploading ? t("account.uploading") : activeVoice ? t("studio.reUploadVoice") : t("studio.uploadVoice")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,.mp3,.wav"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFileSelected(file);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="text-[10px] text-red-400 mt-2">{error}</p>}

      <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={usePersonaVoice}
          disabled={!completedVoice}
          onChange={(e) => setUsePersonaVoice(e.target.checked)}
          className="accent-accent disabled:opacity-40"
        />
        <span className={`text-sm ${completedVoice ? "text-ink-muted" : "text-ink-dim"}`}>
          {t("studio.useMyVoiceLabel")}
        </span>
      </label>
      {usePersonaVoice && (
        <p className="text-[10px] text-ink-dim mt-1">{t("studio.personaVoiceHint")}</p>
      )}

      <NameVoiceDialog
        isOpen={showNameDialog}
        onClose={() => setShowNameDialog(false)}
        voice={completedVoice ?? null}
        onSaved={(updated) =>
          setVoices((prev) => prev.map((v) => (v.id === updated.id ? { ...v, name: updated.name } : v)))
        }
      />
    </div>
  );
}
