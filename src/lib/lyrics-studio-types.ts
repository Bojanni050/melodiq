import type { LyricBlock } from "@/lib/lyrics-utils";

export interface LyricStudioSnapshot {
  id: string;
  name: string;
  createdAt: string;
  payload: {
    topic: string;
    mood: string;
    style: string;
    vocalistTag: "auto" | "male" | "female" | "together" | "duet";
    performerDirections: string;
    blocks: LyricBlock[];
    activePreset: string;
    lyricCols: number;
    showLyricsSidebar: boolean;
    structure: string;
    customStructure: string;
    language: string;
    customLanguage: string;
    repetitiveChorus: boolean;
    creativityLevel: number;
    contextLevel: number;
    styleSuggestion: string;
  };
}

export type LyricsStudioNotice = {
  type: "error" | "success" | "info";
  message: string;
};

export type ConfirmAction = "replaceBlocks" | "replaceStudio" | "clearAll" | null;
