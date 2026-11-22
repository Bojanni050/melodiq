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
  const [error, setError] = useState<string | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const activeVoice = voices[0];
  const completedVoices = voices.filter((v) => v.status === "completed");
  // The explicit pick wins; before the user ever picks one, the first
  // completed voice keeps the pre-picker behaviour.
  const selectedVoice = completedVoices.find((v) => v.isSelected) ?? completedVoices[0];

  const pendingModel = models.find((m) => m.status === "pending");
  const completedModels = models.filter((m) => m.status === "completed");
  const selectedModel = completedModels.find((m) => m.isSelected) ?? completedModels[0];

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
    // Wait for the list to arrive: on the first render there is no voice yet,
    // and turning the persona off then would undo the stored choice.
    if (loaded && !selectedVoice && usePersonaVoice) setUsePersonaVoice(false);
  }, [loaded, selectedVoice, usePersonaVoice, setUsePersonaVoice]);

  // A model can finish training while the Studio is open — same 4s cadence as
  // the voice poll, so the picker fills in without a reload.
  useEffect(() => {
    if (modelPollTimerRef.current) {
      clearTimeout(modelPollTimerRef.current);
      modelPollTimerRef.current = null;
    }
    if (!pendingModel) return;

    modelPollTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/dna-model/status/${pendingModel.id}`);
        if (res.ok) {
          const data = await res.json();
          setModels((prev) => prev.map((m) => (m.id === data.model.id ? data.model : m)));
        }
      } catch {}
    }, POLL_INTERVAL_MS);

    return () => {
      if (modelPollTimerRef.current) clearTimeout(modelPollTimerRef.current);
    };
  }, [pendingModel]);

  useEffect(() => {
    if (modelsLoaded && !selectedModel && useDnaModel) setUseDnaModel(false);
  }, [modelsLoaded, selectedModel, useDnaModel, setUseDnaModel]);

  const handleSelectVoice = useCallback(async (voiceId: string) => {
    try {
      const res = await fetch("/api/voice/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      // The route returns the full refreshed list, so the header and picker
      // both flip to the new selection from one source of truth.
      if (data.voices) setVoices(data.voices);
      return true;
    } catch {
      // A failed selection is not worth an error banner — the old selection
      // simply stays active and the user can retry.
      return false;
    }
  }, []);

  /**
   * The picker is the whole control: choosing a voice turns it on for the next
   * generation, choosing "no saved voice" turns the persona off. The selection
   * only becomes active after the server accepted it, because
   * useStudioActions reads the stored selection when it builds the request.
   */
  const handleVoiceChange = useCallback(
    async (voiceId: string) => {
      if (!voiceId) {
        setUsePersonaVoice(false);
        return;
      }
      if (await handleSelectVoice(voiceId)) setUsePersonaVoice(true);
    },
    [handleSelectVoice, setUsePersonaVoice]
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
    <div className="space-y-3">
      {/* An instrumental has no singer, and APIMart rejects persona_id without
          lyrics — the voice controls only make sense on a vocal track. */}
      {!instrumental && (
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-medium text-ink-muted">
              {selectedVoice?.name || t("studio.myClonedVoice")}
            </p>
            {selectedVoice &&
              (selectedVoice.name ? (
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
            {loaded && selectedVoice && t("studio.voiceReadyToUse")}
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
      )}

      {error && <p className="text-[10px] text-red-400 mt-2">{error}</p>}

      {!instrumental && completedVoices.length > 0 && (
        <label className="flex items-center gap-2">
          <span className="text-[10px] text-ink-dim shrink-0">{t("studio.voicePickerLabel")}</span>
          <select
            value={usePersonaVoice && selectedVoice ? selectedVoice.id : ""}
            onChange={(e) => void handleVoiceChange(e.target.value)}
            aria-label={t("studio.voicePickerLabel")}
            className="input-field text-sm py-1.5 min-w-0"
          >
            <option value="">{t("studio.noSavedVoiceOption")}</option>
            {completedVoices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name ||
                  `${t("studio.unnamedVoiceOption")} · ${new Date(v.createdAt).toLocaleDateString()}`}
              </option>
            ))}
          </select>
        </label>
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

      {usePersonaVoice && selectedVoice && (
        <p className="text-[10px] text-ink-dim">{t("studio.personaVoiceHint")}</p>
      )}

      {useDnaModel && selectedModel && (
        <p className="text-[10px] text-ink-dim">{t("studio.dnaModelHint")}</p>
      )}

      <NameVoiceDialog
        isOpen={showNameDialog}
        onClose={() => setShowNameDialog(false)}
        voice={selectedVoice ?? null}
        onSaved={(updated) =>
          setVoices((prev) => prev.map((v) => (v.id === updated.id ? { ...v, name: updated.name } : v)))
        }
      />
    </div>
  );
}
