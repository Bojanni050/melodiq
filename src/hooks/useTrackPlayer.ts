"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { usePlayerStore, useWorkspaceStore } from "@/lib/store";
import type { Track } from "./useTrackManager";

type CreditsResponse = {
  lyria: string | number;
  poyo: number | null;
  tempolor: number | null;
  minimax: number | null;
  apiframe: number | null;
};

async function jsonFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(res.statusText || "Request failed");
  return (await res.json()) as T;
}

interface UseTrackPlayerOptions {
  tracksRef: React.RefObject<Track[]>;
}

export function useTrackPlayer({ tracksRef }: UseTrackPlayerOptions) {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const showTrackDetailsPanel = usePlayerStore((state) => state.showTrackDetailsPanel);
  const setShowTrackDetailsPanel = usePlayerStore((state) => state.setShowTrackDetailsPanel);
  const rightPanelWidth = usePlayerStore((state) => state.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((state) => state.setRightPanelWidth);

  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [credits, setCredits] = useState({
    lyria: "Pay-per-use" as string | number,
    poyo: null as number | null,
    tempolor: null as number | null,
    minimax: null as number | null,
    apiframe: null as number | null,
  });

  const { data: creditsResponse } = useSWR<CreditsResponse>("/api/credits", jsonFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  useEffect(() => {
    if (creditsResponse) setCredits(creditsResponse);
  }, [creditsResponse]);

  // Sync CSS variable for right panel width
  useEffect(() => {
    document.documentElement.style.setProperty("--right-panel-width", `${rightPanelWidth}px`);
  }, [rightPanelWidth]);

  // Keep selectedTrack in sync when panel opens or tracks update
  useEffect(() => {
    if (!showTrackDetailsPanel) return;

    setSelectedTrack((prev) => {
      if (prev) {
        const matched = tracksRef.current.find((t) => t.id === prev.id);
        if (matched) return matched;
        return prev;
      }
      if (currentTrack) {
        const matchedTrack = tracksRef.current.find((t) => t.id === currentTrack.id);
        if (matchedTrack) return matchedTrack;

        return {
          id: currentTrack.id,
          title: currentTrack.title,
          provider: currentTrack.provider,
          providerModel: currentTrack.providerModel,
          prompt: currentTrack.prompt,
          lyrics: currentTrack.lyrics,
          lyricsTimestamps: currentTrack.lyricsTimestamps,
          status: currentTrack.status,
          audioUrl: currentTrack.audioUrl,
          audioUrlHd: currentTrack.audioUrlHd,
          s3Key: currentTrack.s3Key ?? null,
          format: currentTrack.format ?? null,
          formatHd: currentTrack.formatHd ?? null,
          duration: currentTrack.duration ?? null,
          createdAt: currentTrack.createdAt,
          error: currentTrack.error,
          s3KeyHd: currentTrack.s3KeyHd,
          coverUrl: currentTrack.coverUrl ?? null,
          s3KeyCover: currentTrack.s3KeyCover ?? null,
          s3KeyCoverThumb: currentTrack.s3KeyCoverThumb ?? null,
          playCount: currentTrack.playCount ?? null,
          rating: currentTrack.rating ?? null,
        };
      }
      return null;
    });
  }, [showTrackDetailsPanel, currentTrack, tracksRef]);

  // Follow currently-playing track when panel is open
  const prevIsPlaying = useRef(isPlaying);
  const prevCurrentTrackId = useRef(currentTrack?.id);

  useEffect(() => {
    const playResumed = isPlaying && !prevIsPlaying.current;
    const trackChanged = currentTrack?.id !== prevCurrentTrackId.current;

    prevIsPlaying.current = isPlaying;
    prevCurrentTrackId.current = currentTrack?.id;

    if (showTrackDetailsPanel && currentTrack && (playResumed || trackChanged)) {
      setSelectedTrack((prev) => {
        if (prev?.id === currentTrack.id) return prev;
        const matched = tracksRef.current.find((t) => t.id === currentTrack.id);
        return matched || (currentTrack as unknown as Track);
      });
    }
  }, [isPlaying, currentTrack, showTrackDetailsPanel, tracksRef]);

  const handleSelectTrack = useCallback((track: Track) => {
    setSelectedTrack(track);
    setShowTrackDetailsPanel(true);
  }, [setShowTrackDetailsPanel]);

  const handleCloseTrackDetails = useCallback(() => {
    setSelectedTrack(null);
    setShowTrackDetailsPanel(false);
  }, [setShowTrackDetailsPanel]);

  const handleDeleteTrackFromPlayer = useCallback((trackId: string) => {
    setSelectedTrack((prev) => (prev?.id === trackId ? null : prev));
  }, []);

  const handlePlayTrack = useCallback((url: string) => {
    if (!selectedTrack) return;
    const player = usePlayerStore.getState();
    const playContext = tracksRef.current
      .filter((t) => t.status === "done")
      .map((t) => ({
        id: t.id,
        title: t.title,
        provider: t.provider,
        providerModel: t.providerModel,
        prompt: t.prompt,
        status: t.status,
        audioUrl: t.audioUrl,
        audioUrlHd: t.audioUrlHd,
        format: t.format,
        formatHd: t.formatHd,
        s3Key: null,
        s3KeyHd: t.s3KeyHd,
        duration: null,
        lyrics: t.lyrics,
        lyricsTimestamps: t.lyricsTimestamps,
        createdAt: t.createdAt,
        error: t.error,
        coverUrl: t.coverUrl,
        s3KeyCover: t.s3KeyCover,
        s3KeyCoverThumb: t.s3KeyCoverThumb,
      }));

    player.setPlayContext(playContext);

    if (player.autoPlayNext) {
      const index = playContext.findIndex((t) => t.id === selectedTrack.id);
      if (index >= 0) {
        player.setQueue(playContext.slice(index + 1));
      }
    }
    player.playTrackFromGesture({
      id: selectedTrack.id,
      title: selectedTrack.title,
      provider: selectedTrack.provider,
      providerModel: selectedTrack.providerModel,
      prompt: selectedTrack.prompt,
      status: selectedTrack.status,
      audioUrl: url,
      audioUrlHd: selectedTrack.audioUrlHd,
      format: selectedTrack.format,
      formatHd: selectedTrack.formatHd,
      s3Key: null,
      s3KeyHd: selectedTrack.s3KeyHd,
      duration: null,
      lyrics: selectedTrack.lyrics,
      lyricsTimestamps: selectedTrack.lyricsTimestamps,
      createdAt: selectedTrack.createdAt,
      error: selectedTrack.error,
      coverUrl: selectedTrack.coverUrl,
      s3KeyCover: selectedTrack.s3KeyCover,
      s3KeyCoverThumb: selectedTrack.s3KeyCoverThumb,
    });
  }, [selectedTrack, tracksRef]);

  const handleDownloadTrack = useCallback((url: string, hd: boolean) => {
    const a = document.createElement("a");
    a.href = url;
    const fmt = hd
      ? (selectedTrack?.formatHd ?? selectedTrack?.format ?? "mp3")
      : (selectedTrack?.format ?? "mp3");
    a.download = `${selectedTrack?.title || "track"}${hd ? "_hd" : ""}.${fmt}`;
    a.click();
  }, [selectedTrack]);

  const handleAddToQueue = useCallback((track: Track) => {
    usePlayerStore.getState().enqueueTrack({
      id: track.id,
      title: track.title,
      provider: track.provider,
      providerModel: track.providerModel,
      prompt: track.prompt,
      status: track.status,
      audioUrl: track.audioUrl,
      audioUrlHd: track.audioUrlHd,
      format: track.format,
      formatHd: track.formatHd,
      s3Key: null,
      s3KeyHd: track.s3KeyHd,
      duration: null,
      lyrics: track.lyrics,
      createdAt: track.createdAt,
      error: track.error,
      coverUrl: track.coverUrl,
      s3KeyCover: track.s3KeyCover,
      s3KeyCoverThumb: track.s3KeyCoverThumb,
    });
  }, []);

  const handleAddToPlaylist = useCallback((
    trackId: string,
    playlistId: string,
    options?: { allowDuplicate?: boolean }
  ) => {
    const { addTrackToPlaylist } = usePlayerStore.getState() as unknown as {
      addTrackToPlaylist: (playlistId: string, trackId: string, options?: { allowDuplicate?: boolean }) => void;
    };
    // Use the playlist store directly
    import("@/lib/store").then(({ usePlaylistStore }) => {
      usePlaylistStore.getState().addTrackToPlaylist(playlistId, trackId, options);
    });
  }, []);

  const handleMoveTrackToWorkspace = useCallback((trackId: string, workspaceId: string) => {
    useWorkspaceStore.getState().moveTrackToWorkspace(workspaceId, trackId);
    useWorkspaceStore.getState().setSelectedWorkspaceId(workspaceId);
  }, []);

  const creditValue =
    typeof credits.poyo === "number"
      ? credits.poyo
      : typeof credits.tempolor === "number"
        ? credits.tempolor
        : typeof credits.apiframe === "number"
          ? credits.apiframe
          : null;

  return {
    credits,
    creditValue,
    selectedTrack,
    setSelectedTrack,
    showTrackDetailsPanel,
    rightPanelWidth,
    setRightPanelWidth,
    handleSelectTrack,
    handleCloseTrackDetails,
    handleDeleteTrackFromPlayer,
    handlePlayTrack,
    handleDownloadTrack,
    handleAddToQueue,
    handleAddToPlaylist,
    handleMoveTrackToWorkspace,
  };
}
