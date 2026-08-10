"use client";

import { useEffect, useState } from "react";
import type { TrackDetailTrack } from "./types";

export function usePromptEditor(
  track: TrackDetailTrack,
  initialTrack: TrackDetailTrack,
  onSaved: (updatedTrack: TrackDetailTrack) => void,
) {
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [promptDraft, setPromptDraft] = useState(initialTrack.prompt);
  const [promptEditing, setPromptEditing] = useState(false);
  const [promptSaving, setPromptSaving] = useState(false);

  useEffect(() => {
    setPromptDraft(initialTrack.prompt);
    setPromptEditing(false);
  }, [initialTrack]);

  const promptDraftIsValid = promptDraft.trim().length > 0;

  function startEditingPrompt() {
    setPromptDraft(track.prompt);
    setPromptEditing(true);
    setPromptExpanded(true);
  }

  function cancelEditingPrompt() {
    setPromptDraft(track.prompt);
    setPromptEditing(false);
  }

  async function handleSavePrompt() {
    const trimmedPrompt = promptDraft.trim();
    if (!trimmedPrompt) return;

    setPromptSaving(true);
    try {
      const res = await fetch(`/api/tracks/${track.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmedPrompt }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message = payload && typeof payload.error === "string" ? payload.error : "Failed to update prompt";
        throw new Error(message);
      }

      const updatedTrack = await res.json();
      onSaved(updatedTrack);
      setPromptEditing(false);
      setPromptDraft(updatedTrack.prompt);
      setPromptExpanded(true);
    } catch (error) {
      console.error("Failed to update prompt:", error);
    } finally {
      setPromptSaving(false);
    }
  }

  return {
    promptExpanded, setPromptExpanded,
    promptDraft, setPromptDraft,
    promptEditing, promptSaving, promptDraftIsValid,
    startEditingPrompt, cancelEditingPrompt, handleSavePrompt,
  };
}
