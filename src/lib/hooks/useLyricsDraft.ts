"use client";

import { useEffect, useState } from "react";
import { BLOCK_TYPES } from "@/lib/lyrics-studio-constants";
import { buildLyricsStudioDraftPayload, parseSavedLyricsSnapshots, sanitizeLyricBlocksForLoad } from "@/lib/lyrics-studio-draft";
import type { LyricStudioSnapshot } from "@/lib/lyrics-studio-types";
import { BLOCK_LABELS, type BlockType, type LyricBlock } from "@/lib/lyrics-utils";
import { useStudioStore } from "@/lib/store";

const STORAGE_KEY = "sonara-lyrics-studio";
const SNAPSHOTS_KEY = "sonara-lyrics-studio-snapshots";

export interface LyricsDraftState {
  topic: string;
  setTopic: (v: string) => void;
  mood: string;
  setMood: (v: string) => void;
  style: string;
  setStyle: (v: string) => void;
  vocalistTag: "auto" | "male" | "female" | "together";
  setVocalistTag: (v: "auto" | "male" | "female" | "together") => void;
  performerDirections: string;
  setPerformerDirections: (v: string) => void;
  blocks: LyricBlock[];
  setBlocks: React.Dispatch<React.SetStateAction<LyricBlock[]>>;
  activePreset: string;
  setActivePreset: (v: string) => void;
  lyricCols: number;
  setLyricCols: (v: number) => void;
  showLyricsSidebar: boolean;
  setShowLyricsSidebar: React.Dispatch<React.SetStateAction<boolean>>;
  repetitiveChorus: boolean;
  setRepetitiveChorus: (v: boolean) => void;
  creativityLevel: number;
  setCreativityLevel: (v: number) => void;
  contextLevel: number;
  setContextLevel: (v: number) => void;
  styleSuggestion: string;
  setStyleSuggestion: (v: string) => void;
  savedSnapshots: LyricStudioSnapshot[];
  setSavedSnapshots: (v: LyricStudioSnapshot[]) => void;
  hasRestoredDraft: boolean;
}

export function useLyricsDraft(): LyricsDraftState {
  const { language, customLanguage, structure, customStructure, setLanguage, setCustomLanguage, setStructure, setCustomStructure } = useStudioStore();

  const [topic, setTopic] = useState("");
  const [mood, setMood] = useState("");
  const [style, setStyle] = useState("");
  const [vocalistTag, setVocalistTag] = useState<"auto" | "male" | "female" | "together">("auto");
  const [performerDirections, setPerformerDirections] = useState("");
  const [blocks, setBlocks] = useState<LyricBlock[]>([]);
  const [activePreset, setActivePreset] = useState("");
  const [lyricCols, setLyricCols] = useState(2);
  const [showLyricsSidebar, setShowLyricsSidebar] = useState(false);
  const [repetitiveChorus, setRepetitiveChorus] = useState(true);
  const [creativityLevel, setCreativityLevel] = useState(5);
  const [contextLevel, setContextLevel] = useState(5);
  const [styleSuggestion, setStyleSuggestion] = useState("");
  const [savedSnapshots, setSavedSnapshots] = useState<LyricStudioSnapshot[]>([]);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // Restore draft from localStorage on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHasRestoredDraft(true);
        return;
      }

      const parsed = JSON.parse(raw) as {
        topic?: string; mood?: string; style?: string;
        vocalistTag?: "auto" | "male" | "female" | "together";
        performerDirections?: string;
        blocks?: Array<Partial<LyricBlock>>; activePreset?: string;
        lyricCols?: number; showLyricsSidebar?: boolean;
        structure?: string; customStructure?: string;
        language?: string; customLanguage?: string;
        repetitiveChorus?: boolean; creativityLevel?: number;
        contextLevel?: number; styleSuggestion?: string;
      };

      if (typeof parsed.topic === "string") setTopic(parsed.topic);
      if (typeof parsed.mood === "string") setMood(parsed.mood);
      if (typeof parsed.style === "string") setStyle(parsed.style);
      if (parsed.vocalistTag === "auto" || parsed.vocalistTag === "male" || parsed.vocalistTag === "female" || parsed.vocalistTag === "together") {
        setVocalistTag(parsed.vocalistTag);
      }
      if (typeof parsed.performerDirections === "string") setPerformerDirections(parsed.performerDirections);
      if (typeof parsed.activePreset === "string") setActivePreset(parsed.activePreset);
      if (parsed.lyricCols === 1 || parsed.lyricCols === 2) setLyricCols(parsed.lyricCols);
      if (typeof parsed.showLyricsSidebar === "boolean") setShowLyricsSidebar(parsed.showLyricsSidebar);
      if (typeof parsed.structure === "string") setStructure(parsed.structure);
      if (typeof parsed.customStructure === "string") setCustomStructure(parsed.customStructure);
      if (typeof parsed.language === "string") setLanguage(parsed.language);
      if (typeof parsed.customLanguage === "string") setCustomLanguage(parsed.customLanguage);
      if (typeof parsed.repetitiveChorus === "boolean") setRepetitiveChorus(parsed.repetitiveChorus);
      if (typeof parsed.creativityLevel === "number" && parsed.creativityLevel >= 1 && parsed.creativityLevel <= 10) {
        setCreativityLevel(Math.round(parsed.creativityLevel));
      }
      if (typeof parsed.contextLevel === "number" && parsed.contextLevel >= 1 && parsed.contextLevel <= 10) {
        setContextLevel(Math.round(parsed.contextLevel));
      }
      if (typeof parsed.styleSuggestion === "string") setStyleSuggestion(parsed.styleSuggestion);

      if (Array.isArray(parsed.blocks)) {
        const validTypes = new Set<BlockType>(BLOCK_TYPES);
        const restored: LyricBlock[] = parsed.blocks
          .filter((b): b is Partial<LyricBlock> & { type: BlockType } => !!b?.type && validTypes.has(b.type as BlockType))
          .map((b, i) => ({
            id: typeof b.id === "string" && b.id.trim() ? b.id : `restored-${i}-${crypto.randomUUID()}`,
            type: b.type,
            label: typeof b.label === "string" && b.label.trim() ? b.label : BLOCK_LABELS[b.type],
            content: typeof b.content === "string" ? b.content : "",
            generating: false,
            uniqueChorusOverride: b.type === "chorus" && typeof b.uniqueChorusOverride === "boolean" ? b.uniqueChorusOverride : false,
          }));
        setBlocks(restored);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHasRestoredDraft(true);
    }
  }, [setCustomLanguage, setCustomStructure, setLanguage, setStructure]);

  // Restore snapshots on mount
  useEffect(() => {
    const raw = window.localStorage.getItem(SNAPSHOTS_KEY);
    setSavedSnapshots(parseSavedLyricsSnapshots(raw));
  }, []);

  // Persist draft whenever state changes
  useEffect(() => {
    if (!hasRestoredDraft) return;
    const payload = buildLyricsStudioDraftPayload({
      topic, mood, style, vocalistTag, performerDirections, blocks, activePreset, lyricCols, showLyricsSidebar,
      structure, customStructure, language, customLanguage,
      repetitiveChorus, creativityLevel, contextLevel, styleSuggestion,
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    activePreset, blocks, customLanguage, customStructure, hasRestoredDraft,
    language, lyricCols, mood, repetitiveChorus, creativityLevel, contextLevel,
    showLyricsSidebar, styleSuggestion, structure, style, topic, vocalistTag, performerDirections,
  ]);

  return {
    topic, setTopic,
    mood, setMood,
    style, setStyle,
    vocalistTag, setVocalistTag,
    performerDirections, setPerformerDirections,
    blocks, setBlocks,
    activePreset, setActivePreset,
    lyricCols, setLyricCols,
    showLyricsSidebar, setShowLyricsSidebar,
    repetitiveChorus, setRepetitiveChorus,
    creativityLevel, setCreativityLevel,
    contextLevel, setContextLevel,
    styleSuggestion, setStyleSuggestion,
    savedSnapshots, setSavedSnapshots,
    hasRestoredDraft,
  };
}

export { SNAPSHOTS_KEY, STORAGE_KEY };

export function saveSnapshotsToStorage(snapshots: LyricStudioSnapshot[]) {
  window.localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
}

export function loadSnapshotIntoState(
  snapshot: LyricStudioSnapshot,
  state: LyricsDraftState,
  storeFns: { setStructure: (v: string) => void; setCustomStructure: (v: string) => void; setLanguage: (v: string) => void; setCustomLanguage: (v: string) => void }
) {
  const { payload } = snapshot;
  state.setTopic(payload.topic || "");
  state.setMood(payload.mood || "");
  state.setStyle(payload.style || "");
  state.setVocalistTag(payload.vocalistTag === "male" || payload.vocalistTag === "female" || payload.vocalistTag === "together" ? payload.vocalistTag : "auto");
  state.setPerformerDirections(payload.performerDirections || "");
  state.setBlocks(sanitizeLyricBlocksForLoad(payload.blocks || [], BLOCK_TYPES, BLOCK_LABELS));
  state.setActivePreset(payload.activePreset || "");
  state.setLyricCols(payload.lyricCols === 1 ? 1 : 2);
  state.setShowLyricsSidebar(Boolean(payload.showLyricsSidebar));
  storeFns.setStructure(payload.structure || "");
  storeFns.setCustomStructure(payload.customStructure || "");
  storeFns.setLanguage(payload.language || "English");
  storeFns.setCustomLanguage(payload.customLanguage || "");
  state.setRepetitiveChorus(typeof payload.repetitiveChorus === "boolean" ? payload.repetitiveChorus : true);
  state.setCreativityLevel(typeof payload.creativityLevel === "number" && payload.creativityLevel >= 1 && payload.creativityLevel <= 10 ? Math.round(payload.creativityLevel) : 5);
  state.setContextLevel(typeof payload.contextLevel === "number" && payload.contextLevel >= 1 && payload.contextLevel <= 10 ? Math.round(payload.contextLevel) : 7);
  state.setStyleSuggestion(payload.styleSuggestion || "");
}
