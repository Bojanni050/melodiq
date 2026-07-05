"use client";

import { useCallback, useState } from "react";
import { useStudioStore, useWorkspaceStore, DEFAULT_WORKSPACE_ID } from "@/lib/store";
import type { Track, TracksResponse } from "./useTrackManager";

const MUSICGPT_LYRICS_MAX_CHARS = 3000;

function deriveWorkspaceNameFromTitle(rawTitle: string): string {
  const cleaned = rawTitle
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 100);
}

interface UseStudioActionsOptions {
  tracksRef: React.RefObject<Track[]>;
  fetchTracks: () => Promise<Track[]>;
}

export function useStudioActions({ tracksRef, fetchTracks }: UseStudioActionsOptions) {
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [showLyricsOverlay, setShowLyricsOverlay] = useState(false);

  const getEffectiveLanguage = useCallback(() => {
    const { language, customLanguage } = useStudioStore.getState();
    return language === "Other..." ? customLanguage.trim() || language : language;
  }, []);

  const handleOptimize = useCallback(async () => {
    const { songIdea, selectedProviders, lyricsContext, structure, customStructure, vocalGender } = useStudioStore.getState();
    const provider = Object.keys(selectedProviders)[0] || "poyo";
    const res = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "optimize",
        idea: songIdea,
        provider,
        language: getEffectiveLanguage(),
        context: lyricsContext,
        structure,
        customStructure,
        vocalGender,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      useStudioStore.getState().setSongIdea(data.result);
    }
  }, [getEffectiveLanguage]);

  const handleGenerateLyrics = useCallback(async () => {
    setShowLyricsOverlay(true);
    const { songIdea, lyricsContext, instrumental, structure, customStructure, vocalGender } = useStudioStore.getState();
    try {
      const res = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "lyrics",
          idea: songIdea,
          context: lyricsContext,
          language: getEffectiveLanguage(),
          instrumental,
          structure,
          customStructure,
          vocalGender,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        useStudioStore.getState().setLyrics(data.result);
      }
    } finally {
      setShowLyricsOverlay(false);
    }
  }, [getEffectiveLanguage]);

  const handleGenerateTitle = useCallback(async (lyrics: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/generate-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.title;
      }
    } catch {}
    return null;
  }, []);

  const handleGenerate = useCallback(async () => {
    const {
      songIdea,
      lyrics,
      title,
      selectedProviders,
      instrumental,
      autoCreateWorkspaceFromGeneratedTitle,
      vocalGender,
      weirdness,
      styleInfluence,
    } = useStudioStore.getState();

    const providerEntries = Object.entries(selectedProviders);

    if (providerEntries.length === 0) {
      setNotice({ type: "error", message: "Selecteer minimaal één provider." });
      return;
    }

    if (selectedProviders.musicgpt && lyrics.length > MUSICGPT_LYRICS_MAX_CHARS) {
      setNotice({
        type: "error",
        message: `MusicGPT lyrics mogen maximaal ${MUSICGPT_LYRICS_MAX_CHARS} karakters zijn.`,
      });
      return;
    }

    if (selectedProviders.heartmula && !lyrics.trim()) {
      setNotice({
        type: "error",
        message: "HeartMuLa vereist lyrics met structuurtags (bijv. [Verse], [Chorus], [intro-short]).",
      });
      return;
    }

    setGenerating(true);
    // Yield to the browser main thread so it paints the button's loading state instantly at 60fps
    await new Promise((resolve) => setTimeout(resolve, 50));

    const existingTrackIds = new Set(tracksRef.current.map((track) => track.id));
    const selectedWorkspaceId = useWorkspaceStore.getState().selectedWorkspaceId;
    const targetWorkspaceId =
      selectedWorkspaceId && selectedWorkspaceId !== DEFAULT_WORKSPACE_ID
        ? selectedWorkspaceId
        : useWorkspaceStore.getState().ensureDefaultWorkspace();

    try {
      const needsTitle = !instrumental && !title.trim() && lyrics.trim();
      let finalTitle = title;
      if (needsTitle) {
        const generatedTitle = await handleGenerateTitle(lyrics);
        if (generatedTitle) {
          finalTitle = generatedTitle;
          useStudioStore.getState().setTitle(finalTitle);
        }
      }

      const effectiveLanguage = getEffectiveLanguage();
      const results = await Promise.allSettled(
        providerEntries.map(([provider, providerModel]) =>
          fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: songIdea,
              lyrics,
              title: finalTitle,
              provider,
              providerModel,
              language: effectiveLanguage,
              instrumental,
              vocalGender,
              weirdness,
              styleInfluence,
            }),
          }).then(async (res) => {
            const data = await res.json();
            return { ok: res.ok, data, provider };
          })
        )
      );

      const allTrackIds: string[] = [];
      const generatedTitles: string[] = [];
      const errors: string[] = [];

      for (const result of results) {
        if (result.status === "fulfilled") {
          const { ok, data, provider } = result.value;
          if (ok) {
            const returnedTracks: Track[] = Array.isArray(data.tracks)
              ? data.tracks
              : data.track
                ? [data.track]
                : [];
            const ids: string[] = returnedTracks.map((t: Track) => t.id).filter(Boolean);
            const titles = returnedTracks
              .map((t: Track) => (typeof t.title === "string" ? t.title.trim() : ""))
              .filter(Boolean);
            generatedTitles.push(...titles);
            allTrackIds.push(...ids);
          } else {
            errors.push(`${provider}: ${data.error || "failed"}`);
          }
        } else {
          errors.push("Generation request failed");
        }
      }

      let finalWorkspaceId = targetWorkspaceId;
      if (autoCreateWorkspaceFromGeneratedTitle && allTrackIds.length > 0) {
        const preferredTitle = finalTitle.trim() || generatedTitles[0] || "";
        const workspaceName = deriveWorkspaceNameFromTitle(preferredTitle);
        if (workspaceName) {
          const createdWorkspaceId = useWorkspaceStore.getState().createWorkspace(workspaceName);
          if (createdWorkspaceId) {
            finalWorkspaceId = createdWorkspaceId;
            useWorkspaceStore.getState().setSelectedWorkspaceId(createdWorkspaceId);
          }
        }
      }

      if (allTrackIds.length > 0) {
        useWorkspaceStore.getState().moveTracksToWorkspace(finalWorkspaceId, allTrackIds);
        void fetchTracks();
      } else {
        const latestTracks = await fetchTracks();
        if (finalWorkspaceId !== DEFAULT_WORKSPACE_ID) {
          const discoveredTrackIds = latestTracks
            .map((track) => track.id)
            .filter((trackId) => !existingTrackIds.has(trackId));
          if (discoveredTrackIds.length > 0) {
            useWorkspaceStore.getState().moveTracksToWorkspace(finalWorkspaceId, discoveredTrackIds);
          }
        }
      }

      if (errors.length > 0) {
        setNotice({ type: "error", message: errors.join(" |") });
        if (allTrackIds.length === 0) {
          window.alert(errors.join(" |"));
        }
      } else {
        setNotice(null);
      }
    } catch {
      setNotice({ type: "error", message: "Failed to generate track" });
    } finally {
      setGenerating(false);
    }
  }, [getEffectiveLanguage, handleGenerateTitle, fetchTracks, tracksRef]);

  const handleReusePrompt = useCallback((track: Track) => {
    const studio = useStudioStore.getState();
    studio.setSongIdea("");
    studio.setLyrics("");
    studio.setSongIdea(track.prompt || "");
    studio.setLyrics(track.lyrics || "");
  }, []);

  return {
    generating,
    notice,
    setNotice,
    showLyricsOverlay,
    handleOptimize,
    handleGenerateLyrics,
    handleGenerateTitle,
    handleGenerate,
    handleReusePrompt,
  };
}
