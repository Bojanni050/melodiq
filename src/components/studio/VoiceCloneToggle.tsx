"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStudioStore } from "@/lib/store";
import { useT } from "@/hooks/useT";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { notifyVoicesChanged, VOICES_CHANGED_EVENT } from "@/lib/voice-sync";
import NameVoiceDialog from "./NameVoiceDialog";

interface ClonedVoice {
  id: string;
  status: "pending" | "completed" | "failed";
  personaId: string | null;
  /** Label the user gave it, e.g. when cloning a track from its action menu. */
  name: string | null;
  /** The one voice the Studio sends as persona_id — set via /api/voice/select. */
  isSelected: boolean;
  error: string | null;
  createdAt: string;
}

const POLL_INTERVAL_MS = 4000;

/** A custom APIMart model trained from the user's own tracks (Melody DNA). */
interface DnaModel {
  id: string;
  name: string;
  status: "pending" | "completed" | "failed";
  modelId: string | null;
  isSelected: boolean;
  error: string | null;
  createdAt: string;
}

export default function VoiceCloneToggle({ instrumental = false }: { instrumental?: boolean }) {
  const t = useT();
  const usePersonaVoice = useStudioStore((s) => s.usePersonaVoice);
  const setUsePersonaVoice = useStudioStore((s) => s.setUsePersonaVoice);
  const useDnaModel = useStudioStore((s) => s.useDnaModel);
  const setUseDnaModel = useStudioStore((s) => s.setUseDnaModel);

  const [voices, setVoices] = useState<ClonedVoice[]>([]);
  const [models, setModels] = useState<DnaModel[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameTarget, setNameTarget] = useState<ClonedVoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClonedVoice | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchVoices = useCallback(async () => {
    try {
      const res = await fetch("/api/voice", { cache: "no-store" });
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

  // Another part of the app can create, finish, rename or delete a voice while
  // this picker is mounted (global player, track action menu, another tab).
  // Refetch on that signal, and whenever the tab comes back into view.
  useEffect(() => {
    const refresh = () => void fetchVoices();
    const onVisibility = () => {
      if (!document.hidden) void fetchVoices();
    };
    window.addEventListener(VOICES_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener(VOICES_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchVoices]);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch("/api/dna-model");
      if (!res.ok) return;
      const data = await res.json();
      setModels(data.models ?? []);
    } finally {
      setModelsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void fetchModels();
  }, [fetchModels]);

  const completedVoices = voices.filter((v) => v.status === "completed");
  // Only the row the user (or the first-completion rule in /api/voice/status)
  // marked as selected is the active voice. No fallback: a picker that shows
  // one voice while sending another is exactly what made this block unclear.
  const selectedVoice = completedVoices.find((v) => v.isSelected) ?? null;
  const voiceActive = usePersonaVoice && !!selectedVoice;

  const pendingModel = models.find((m) => m.status === "pending");
  const completedModels = models.filter((m) => m.status === "completed");
  const selectedModel = completedModels.find((m) => m.isSelected) ?? completedModels[0];

  /**
   * The stored selection is the single source of truth: if the server says a
   * completed voice is selected, the next generation uses it — also after a
   * reload, a reset or a voice that finished in the background. A DNA model
   * takes the persona's place, so it is never switched back on behind one.
   */
  useEffect(() => {
    if (!loaded || useDnaModel) return;
    const shouldUse = !!selectedVoice;
    if (shouldUse !== usePersonaVoice) {
      useStudioStore.setState({ usePersonaVoice: shouldUse });
    }
  }, [loaded, selectedVoice, usePersonaVoice, useDnaModel]);

  // A clone can finish while the Studio is open. Poll every pending row (not
  // just the newest) so the row flips to usable without a reload.
  const pendingVoiceIds = voices.filter((v) => v.status === "pending").map((v) => v.id);
  const pendingVoiceKey = pendingVoiceIds.join(",");

  useEffect(() => {
    if (!pendingVoiceKey) return;
    const ids = pendingVoiceKey.split(",");
    let cancelled = false;

    const poll = async () => {
      const updates = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(`/api/voice/status/${id}`);
            if (!res.ok) return null;
            const data = await res.json();
            return (data.voice ?? null) as ClonedVoice | null;
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      const byId = new Map(
        updates.filter((v): v is ClonedVoice => v !== null).map((v) => [v.id, v] as const)
      );
      if (byId.size === 0) return;
      setVoices((prev) => prev.map((v) => byId.get(v.id) ?? v));
    };

    const timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pendingVoiceKey]);

  // A model can finish training while the Studio is open — same 4s cadence as
  // the voice poll, so the picker fills in without a reload.
  useEffect(() => {
    if (!pendingModel) return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/dna-model/status/${pendingModel.id}`);
        if (res.ok) {
          const data = await res.json();
          setModels((prev) => prev.map((m) => (m.id === data.model.id ? data.model : m)));
        }
      } catch {}
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [pendingModel]);

  useEffect(() => {
    if (modelsLoaded && !selectedModel && useDnaModel) setUseDnaModel(false);
  }, [modelsLoaded, selectedModel, useDnaModel, setUseDnaModel]);

  const handleSelectVoice = useCallback(
    async (voiceId: string) => {
      try {
        const res = await fetch("/api/voice/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voiceId }),
        });
        if (!res.ok) {
          setError(t("studio.voiceSelectFailed"));
          return false;
        }
        const data = await res.json();
        // The route returns the full refreshed list, so the list and the
        // status line both flip to the new selection from one source of truth.
        if (data.voices) setVoices(data.voices);
        return true;
      } catch {
        setError(t("studio.voiceSelectFailed"));
        return false;
      }
    },
    [t]
  );

  /**
   * The list is the whole control: picking a voice makes it the one the next
   * generation sends, picking "no saved voice" clears the stored selection so
   * the Studio truly sends no persona. Every choice round-trips to the server —
   * a purely local toggle would show a different state than the one stored.
   */
  const handleVoiceChange = useCallback(
    async (voiceId: string) => {
      setError(null);
      if (!voiceId) {
        try {
          const res = await fetch("/api/voice/select", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ voiceId: null }),
          });
          if (!res.ok) {
            setError(t("studio.voiceSelectFailed"));
            return;
          }
          const data = await res.json();
          if (data.voices) setVoices(data.voices);
          setUsePersonaVoice(false);
        } catch {
          setError(t("studio.voiceSelectFailed"));
        }
        return;
      }
      if (await handleSelectVoice(voiceId)) setUsePersonaVoice(true);
    },
    [handleSelectVoice, setUsePersonaVoice, t]
  );

  /**
   * Same contract as the voice picker: the selection only becomes active after
   * the server accepted it, because useStudioActions reads the stored selection
   * when it builds the request. Picking a model turns the persona off (the
   * store keeps the two mutually exclusive).
   */
  const handleModelChange = useCallback(
    async (modelId: string) => {
      if (!modelId) {
        setUseDnaModel(false);
        return;
      }
      try {
        const res = await fetch("/api/dna-model/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: modelId }),
        });
        if (!res.ok) {
          setError(t("studio.dnaModelNotReady"));
          return;
        }
        const data = await res.json();
        if (data.models) setModels(data.models);
        setUseDnaModel(true);
      } catch {
        setError(t("studio.dnaModelNotReady"));
      }
    },
    [setUseDnaModel, t]
  );

  const handleFileSelected = useCallback(
    async (file: File) => {
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
        notifyVoicesChanged();
      } catch {
        setError(t("account.uploadFailed"));
      } finally {
        setUploading(false);
      }
    },
    [t]
  );

  const handleDeleteVoice = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/voice/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || t("studio.voiceDeleteFailed"));
        return;
      }
      if (data?.voices) setVoices(data.voices);
      setDeleteTarget(null);
      notifyVoicesChanged();
    } catch {
      setError(t("studio.voiceDeleteFailed"));
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, t]);

  const voiceLabel = (voice: ClonedVoice) =>
    voice.name ||
    `${t("studio.unnamedVoiceOption")} · ${new Date(voice.createdAt).toLocaleDateString()}`;

  const voiceStatusText = (voice: ClonedVoice) =>
    voice.status === "completed"
      ? t("studio.voiceReadyToUse")
      : voice.status === "pending"
        ? t("studio.voiceCloningInProgress")
        : voice.error || t("studio.cloningFailed");

  const rowClass = (active: boolean) =>
    `flex w-full items-center gap-2 border px-2.5 py-2 transition-colors ${
      active
        ? "border-accent/40 bg-accent/10"
        : "border-line bg-white/5 hover:bg-white/8"
    }`;

  return (
    <div className="space-y-3">
      {!instrumental && (
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-[10px] text-ink-dim">
            {!loaded && t("library.loading")}
            {loaded && voices.length === 0 && t("studio.noVoiceUploadedYet")}
            {loaded && voices.length > 0 && t("studio.voiceListHint")}
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 text-sm px-3 py-1.5 bg-accent/20 text-accent hover:bg-accent/30 transition-colors disabled:opacity-50"
          >
            {uploading
              ? t("account.uploading")
              : voices.length > 0
                ? t("studio.reUploadVoice")
                : t("studio.uploadVoice")}
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
      )}

      {error && <p className="text-[10px] text-red-400">{error}</p>}

      {!instrumental && loaded && voices.length > 0 && (
        <div role="radiogroup" aria-label={t("studio.voicePickerLabel")} className="space-y-1">
          <button
            type="button"
            role="radio"
            aria-checked={!voiceActive}
            onClick={() => void handleVoiceChange("")}
            className={rowClass(!voiceActive)}
          >
            <span
              aria-hidden
              className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                !voiceActive ? "border-accent" : "border-ink-dim"
              }`}
            >
              {!voiceActive && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
            </span>
            <span className="min-w-0 flex-1 text-left text-sm text-ink-muted">
              {t("studio.noSavedVoiceOption")}
            </span>
          </button>

          {voices.map((voice) => {
            const isActive = voiceActive && selectedVoice?.id === voice.id;
            const selectable = voice.status === "completed";
            return (
              <div key={voice.id} className={rowClass(isActive)}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  aria-label={voiceLabel(voice)}
                  disabled={!selectable}
                  onClick={() => void handleVoiceChange(voice.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-not-allowed"
                >
                  <span
                    aria-hidden
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                      voice.status === "pending"
                        ? "border-amber-400/60"
                        : voice.status === "failed"
                          ? "border-red-400/60"
                          : isActive
                            ? "border-accent"
                            : "border-ink-dim"
                    }`}
                  >
                    {voice.status === "pending" && (
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
                    )}
                    {voice.status === "failed" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    )}
                    {voice.status === "completed" && isActive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm ${
                        isActive ? "text-ink" : "text-ink-muted"
                      }`}
                    >
                      {voiceLabel(voice)}
                    </span>
                    <span className="block truncate text-[10px] text-ink-dim">
                      {voiceStatusText(voice)}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setNameTarget(voice)}
                  aria-label={t("studio.renameVoice")}
                  title={t("studio.renameVoice")}
                  className="shrink-0 p-1 text-ink-dim transition-colors hover:text-ink-muted"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                    />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteTarget(voice)}
                  aria-label={t("studio.voiceDeleteLabel")}
                  title={t("studio.voiceDeleteLabel")}
                  className="shrink-0 p-1 text-ink-dim transition-colors hover:text-red-400"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!instrumental && loaded && voices.length > 0 && (
        <p className="flex items-center gap-1.5 text-[10px]">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              voiceActive ? "bg-accent" : "bg-ink-dim/60"
            }`}
          />
          <span className={voiceActive ? "text-ink-muted" : "text-ink-dim"}>
            {voiceActive && selectedVoice
              ? t("studio.voiceActiveNow", { name: voiceLabel(selectedVoice) })
              : t("studio.voiceNoneActive")}
          </span>
        </p>
      )}

      {completedModels.length > 0 && (
        <label className="flex items-center gap-2">
          <span className="text-[10px] text-ink-dim shrink-0">{t("studio.dnaModelPickerLabel")}</span>
          <select
            value={useDnaModel && selectedModel ? selectedModel.id : ""}
            onChange={(e) => void handleModelChange(e.target.value)}
            aria-label={t("studio.dnaModelPickerLabel")}
            className="input-field text-sm py-1.5 min-w-0"
          >
            <option value="">{t("studio.noDnaModelOption")}</option>
            {completedModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {voiceActive && selectedVoice && (
        <p className="text-[10px] text-ink-dim">{t("studio.personaVoiceHint")}</p>
      )}

      {useDnaModel && selectedModel && (
        <p className="text-[10px] text-ink-dim">{t("studio.dnaModelHint")}</p>
      )}

      <NameVoiceDialog
        isOpen={!!nameTarget}
        onClose={() => setNameTarget(null)}
        voice={nameTarget}
        onSaved={(updated) =>
          setVoices((prev) => prev.map((v) => (v.id === updated.id ? { ...v, name: updated.name } : v)))
        }
      />

      {deleteTarget && (
        <ConfirmModal
          icon={
            <svg className="h-4 w-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          }
          iconBgClassName="bg-red-500/20"
          message={t("studio.voiceDeleteConfirm", { name: voiceLabel(deleteTarget) })}
          cancelLabel={t("common.cancel")}
          confirmLabel={deleting ? t("studio.deleting") : t("studio.delete")}
          confirmClassName="border-red-400/40 bg-red-500/60 text-ink hover:bg-red-500/80"
          onCancel={() => {
            if (!deleting) setDeleteTarget(null);
          }}
          onConfirm={() => void handleDeleteVoice()}
        />
      )}
    </div>
  );
}
