"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import StudioForm from "@/components/StudioForm";
import TrackList from "@/components/TrackList";
import TrackDetail from "@/components/TrackDetail";
import { DEFAULT_WORKSPACE_ID, WORKSPACE_FOLDER_GRADIENTS, useStudioStore, usePlayerStore, usePlaylistStore, useWorkspaceStore } from "@/lib/store";

const MUSICGPT_LYRICS_MAX_CHARS = 3000;
const WORKSPACE_GRID_SIZE_STORAGE_KEY = "sonara-studio-workspace-grid-size";

interface Track {
  id: string;
  title: string | null;
  provider: string;
  providerModel: string;
  prompt: string;
  lyrics: string | null;
  status: "pending" | "generating" | "done" | "failed";
  audioUrl: string | null;
  audioUrlHd: string | null;
  format: string | null;
  formatHd: string | null;
  duration: number | null;
  createdAt: string;
  error: string | null;
  s3KeyHd: string | null;
  coverUrl?: string | null;
  s3KeyCover?: string | null;
  rating?: string | null;
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function pickSeededItems<T>(items: T[], seed: string, limit: number) {
  return [...items]
    .sort((left, right) => hashString(`${seed}:${String(left)}`) - hashString(`${seed}:${String(right)}`))
    .slice(0, limit);
}

function getCoverCollage(workspaceId: string, tracks: Track[]) {
  const coverUrls = tracks
    .filter((track) => !!track.coverUrl)
    .map((track) => track.coverUrl as string);

  return pickSeededItems(coverUrls, workspaceId, 4);
}

function getWorkspaceGradient(workspaceId: string, gradient?: string) {
  if (gradient) return gradient;
  return WORKSPACE_FOLDER_GRADIENTS[hashString(workspaceId) % WORKSPACE_FOLDER_GRADIENTS.length];
}

function deriveWorkspaceNameFromTitle(rawTitle: string): string {
  const cleaned = rawTitle
    .replace(/[\\\\/:*?"<>|]+/g, " ")
    .replace(/\\s+/g, " ")
    .trim();

  return cleaned.slice(0, 100);
}
