"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import useSWR from "swr";
import { usePlayerStore, useWorkspaceStore, fetchAndHydrateSongs, type Track as PlayerTrack, type Workspace } from "@/lib/store";

export interface Track {
  id: string;
  title: string | null;
  provider: string;
  providerModel: string;
  prompt: string;
  lyrics: string | null;
  status: "pending" | "generating" | "done" | "failed";
  audioUrl: string | null;
  audioUrlHd: string | null;
  s3Key?: string | null;
  format: string | null;
  formatHd: string | null;
  duration: number | null;
  createdAt: string;
  error: string | null;
  s3KeyHd: string | null;
  coverUrl?: string | null;
  s3KeyCover?: string | null;
  s3KeyCoverThumb?: string | null;
  rating?: string | null;
  playCount?: number | null;
  votedAt?: string | null;
  songId?: string | null;
  lyricsTimestamps?: string | null;
  artistName?: string | null;
  composerName?: string | null;
  instrumental?: boolean | null;
  language?: string | null;
  releaseStatus?: string | null;
  publishDate?: string | null;
  trackDna?: string | null;
}

export type TracksResponse = { tracks: Track[]; workspaces?: Workspace[] };

async function jsonFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(res.statusText || "Request failed");
  }
  return (await res.json()) as T;
}

const TRACK_UPDATE_CHUNK_THRESHOLD = 100;
const TRACK_UPDATE_CHUNK_SIZE = 50;

function tracksHaveSameRenderableState(a: Track[], b: Track[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].id !== b[i].id ||
      a[i].status !== b[i].status ||
      a[i].title !== b[i].title ||
      a[i].prompt !== b[i].prompt ||
      a[i].coverUrl !== b[i].coverUrl ||
      a[i].audioUrl !== b[i].audioUrl ||
      a[i].audioUrlHd !== b[i].audioUrlHd ||
      a[i].error !== b[i].error ||
      a[i].duration !== b[i].duration ||
      a[i].format !== b[i].format ||
      a[i].formatHd !== b[i].formatHd ||
      a[i].s3KeyHd !== b[i].s3KeyHd ||
      a[i].s3KeyCoverThumb !== b[i].s3KeyCoverThumb ||
      (a[i].lyrics ?? null) !== (b[i].lyrics ?? null) ||
      (a[i].playCount ?? null) !== (b[i].playCount ?? null) ||
      (a[i].rating ?? null) !== (b[i].rating ?? null) ||
      (a[i].lyricsTimestamps ?? null) !== (b[i].lyricsTimestamps ?? null)
    ) {
      return false;
    }
  }
  return true;
}

export function useTrackManager() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const tracksRef = useRef<Track[]>([]);
  const trackUpdateFrameRef = useRef<number | null>(null);
  const trackUpdateBatchRef = useRef(0);
  const [, startTrackUpdateTransition] = useTransition();

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  const { data: tracksResponse, mutate: mutateTracksResponse } = useSWR<TracksResponse>(
    "/api/tracks",
    jsonFetcher,
    { revalidateOnFocus: false, dedupingInterval: 2000 }
  );

  const applyTracksResponse = useCallback((data: TracksResponse) => {
    const next: Track[] = (Array.isArray(data.tracks) ? data.tracks : []).map((t) => ({
      ...t,
      title: t.title ? t.title.replace(/\s*\(2\)\s*$/, "") : t.title,
      artistName: t.artistName ?? null,
      composerName: t.composerName ?? null,
      instrumental: t.instrumental ?? null,
      language: t.language ?? null,
    }));

    const playerSnapshots: PlayerTrack[] = next.map((track) => ({
      id: track.id,
      title: track.title,
      provider: track.provider,
      providerModel: track.providerModel,
      prompt: track.prompt,
      status: track.status,
      audioUrl: track.audioUrl,
      audioUrlHd: track.audioUrlHd,
      s3Key: track.s3Key ?? null,
      s3KeyHd: track.s3KeyHd,
      format: track.format,
      formatHd: track.formatHd,
      duration: track.duration,
      lyrics: track.lyrics,
      lyricsTimestamps: track.lyricsTimestamps,
      createdAt: track.createdAt,
      error: track.error,
      rating: track.rating ?? null,
      coverUrl: track.coverUrl ?? null,
      s3KeyCover: track.s3KeyCover ?? null,
      s3KeyCoverThumb: track.s3KeyCoverThumb ?? null,
      playCount: track.playCount ?? null,
    }));

    usePlayerStore.getState().syncTrackSnapshots(playerSnapshots);

    if (trackUpdateFrameRef.current !== null) {
      cancelAnimationFrame(trackUpdateFrameRef.current);
      trackUpdateFrameRef.current = null;
    }

    const applyTrackUpdate = (updater: (prev: Track[]) => Track[]) => {
      startTrackUpdateTransition(() => {
        setTracks(updater);
      });
    };

    if (next.length < TRACK_UPDATE_CHUNK_THRESHOLD || tracksRef.current.length > 0) {
      const batchId = ++trackUpdateBatchRef.current;
      applyTrackUpdate((prev) => {
        if (batchId !== trackUpdateBatchRef.current) return prev;
        return tracksHaveSameRenderableState(prev, next) ? prev : next;
      });
    } else {
      const batchId = ++trackUpdateBatchRef.current;
      let cursor = 0;

      const applyChunk = () => {
        if (batchId !== trackUpdateBatchRef.current) return;

        cursor = Math.min(cursor + TRACK_UPDATE_CHUNK_SIZE, next.length);
        const slice = next.slice(0, cursor);
        applyTrackUpdate((prev) => {
          if (batchId !== trackUpdateBatchRef.current) return prev;
          return tracksHaveSameRenderableState(prev, slice) ? prev : slice;
        });

        if (cursor < next.length) {
          trackUpdateFrameRef.current = requestAnimationFrame(applyChunk);
          return;
        }

        trackUpdateFrameRef.current = null;
        applyTrackUpdate((prev) => {
          if (batchId !== trackUpdateBatchRef.current) return prev;
          return tracksHaveSameRenderableState(prev, next) ? prev : next;
        });
      };

      applyChunk();
    }

    if (Array.isArray(data.workspaces)) {
      useWorkspaceStore.getState().hydrateWorkspacesFromServer(data.workspaces);
      void fetchAndHydrateSongs();
    }
    useWorkspaceStore.getState().syncTracksToDefaultWorkspace(next.map((track) => track.id));
  }, []);

  useEffect(() => {
    if (tracksResponse) {
      applyTracksResponse(tracksResponse);
    }
  }, [tracksResponse, applyTracksResponse]);

  const fetchTracks = useCallback(async () => {
    try {
      const res = await fetch(`/api/tracks?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const payload = (await res.json()) as TracksResponse;
        await mutateTracksResponse(payload, { revalidate: false });
        applyTracksResponse(payload);
        return payload.tracks ?? [];
      }
    } catch (error) {
      console.error("Failed to fetch tracks directly, falling back to SWR mutate:", error);
    }
    const payload = await mutateTracksResponse();
    if (!payload) return [] as Track[];
    applyTracksResponse(payload);
    return payload.tracks ?? [];
  }, [mutateTracksResponse, applyTracksResponse]);

  const hasGenerating = useMemo(() => tracks.some((t) => t.status === "generating" || t.status === "pending"), [tracks]);
  const hasDoneWithoutCover = useMemo(() => tracks.some((t) => t.status === "done" && !t.coverUrl), [tracks]);
  const hasDoneWithoutHd = useMemo(() => tracks.some((t) => t.status === "done" && t.provider === "poyo" && !t.s3KeyHd), [tracks]);

  useEffect(() => {
    const interval = hasGenerating ? 5000 : hasDoneWithoutCover || hasDoneWithoutHd ? 8000 : 30000;
    const timer = setInterval(() => { fetchTracks(); }, interval);
    return () => clearInterval(timer);
  }, [hasGenerating, hasDoneWithoutCover, hasDoneWithoutHd, fetchTracks]);

  const handleDeleteTrack = useCallback((trackId: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
  }, []);

  const handleTitleUpdate = useCallback((trackId: string, newTitle: string) => {
    setTracks((prev) => {
      const idx = prev.findIndex((t) => t.id === trackId);
      if (idx === -1 || prev[idx].title === newTitle) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], title: newTitle };
      return next;
    });

    void mutateTracksResponse(
      (current) => {
        if (!current) return current;
        const incomingTracks = Array.isArray(current.tracks) ? current.tracks : [];
        return {
          ...current,
          tracks: incomingTracks.map((t) => (t.id === trackId ? { ...t, title: newTitle } : t)),
        };
      },
      { revalidate: false }
    );
  }, [mutateTracksResponse]);

  const handleTrackUpdate = useCallback((updated: Partial<Track> & { id: string }) => {
    setTracks((prev) => {
      const idx = prev.findIndex((t) => t.id === updated.id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...updated };
      return next;
    });

    void mutateTracksResponse(
      (current) => {
        if (!current) return current;
        const incomingTracks = Array.isArray(current.tracks) ? current.tracks : [];
        return {
          ...current,
          tracks: incomingTracks.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
        };
      },
      { revalidate: false }
    );
  }, [mutateTracksResponse]);

  return {
    tracks,
    tracksRef,
    fetchTracks,
    handleDeleteTrack,
    handleTitleUpdate,
    handleTrackUpdate,
  };
}
