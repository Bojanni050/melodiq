"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import LyricsBottomActions from "@/components/lyrics-studio/LyricsBottomActions";
import LyricBlockEditor from "@/components/lyrics-studio/LyricBlockEditor";
import LyricsConfirmModal from "@/components/lyrics-studio/LyricsConfirmModal";
import LyricsControlPanel from "@/components/lyrics-studio/LyricsControlPanel";
import LyricsNotice from "@/components/lyrics-studio/LyricsNotice";
import LyricsSnapshotModals from "@/components/lyrics-studio/LyricsSnapshotModals";
import TranslationReview from "@/components/lyrics-studio/TranslationReview";
import {
  BLOCK_COLORS,
  BLOCK_PRESETS,
  BLOCK_TYPES,
  STRUCTURES,
  STRUCTURE_PRESET_MAP,
  TRANSLATION_LANGUAGES,
} from "@/lib/lyrics-studio-constants";
import { buildLyricsStudioDraftPayload } from "@/lib/lyrics-studio-draft";
import type { ConfirmAction, LyricsStudioNotice, LyricStudioSnapshot } from "@/lib/lyrics-studio-types";
import {
  autoGrowTextarea,
  BLOCK_LABELS,
  combineLyrics,
  countGeneratableBlocks,
  createBlock,
  createPresetBlocks,
  parseStructureText,
  type BlockType,
  type LyricBlock,
} from "@/lib/lyrics-utils";
import { useLyricBlockDrag } from "@/lib/hooks/useLyricBlockDrag";
import { loadSnapshotIntoState, saveSnapshotsToStorage, useLyricsDraft } from "@/lib/hooks/useLyricsDraft";
import { useStudioStore, useSidebarStore } from "@/lib/store";
import { useT } from "@/hooks/useT";

export default function LyricsStudioPage() {
  const t = useT();
  const router = useRouter();
  const draft = useLyricsDraft();
  const {
    topic, setTopic, mood, setMood, style, setStyle,
    vocalistTag, setVocalistTag, performerDirections, setPerformerDirections,
    blocks, setBlocks, activePreset, setActivePreset,
    lyricCols, setLyricCols,
    repetitiveChorus, setRepetitiveChorus,
    creativityLevel, setCreativityLevel,
    literalnessLevel, setLiteralnessLevel,
    contextLevel, setContextLevel,
    styleSuggestion, setStyleSuggestion,
    llmModel, setLlmModel,
    savedSnapshots, setSavedSnapshots,
  } = draft;

  const { title, setTitle, language, customLanguage, structure, customStructure, setLanguage, setCustomLanguage, setStructure, setCustomStructure } = useStudioStore();
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);

  const [customPresets, setCustomPresets] = useState<Record<string, BlockType[]>>({});

  // Restore custom presets on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("melodiq-custom-presets");
      if (raw) {
        setCustomPresets(JSON.parse(raw));
      }
    } catch (error) {
      console.error("Failed to load custom presets", error);
    }
  }, []);

  // Load track-edit payload from sessionStorage (Edit Lyrics button in TrackDetail)
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("lyrics-studio-track-edit");
      if (!raw) return;
      window.sessionStorage.removeItem("lyrics-studio-track-edit");
      const payload = JSON.parse(raw) as {
        trackId: string;
        blocks: Array<{ id?: string; type: BlockType; label: string; content: string; uniqueChorusOverride?: boolean }>;
        title?: string;
        style?: string;
      };
      if (Array.isArray(payload.blocks) && payload.blocks.length > 0) {
        const validTypes = new Set<BlockType>(BLOCK_TYPES);
        const restored: LyricBlock[] = payload.blocks
          .filter((b) => !!b && validTypes.has(b.type) && typeof b.content === "string")
          .map((b) => ({
            id: typeof b.id === "string" && b.id.trim() ? b.id : `track-edit-${crypto.randomUUID()}`,
            type: b.type,
            label: typeof b.label === "string" && b.label.trim() ? b.label : BLOCK_LABELS[b.type],
            content: b.content,
            generating: false,
            uniqueChorusOverride: b.type === "chorus" && typeof b.uniqueChorusOverride === "boolean" ? b.uniqueChorusOverride : false,
          }));
        setBlocks(restored);
      }
      if (payload.title) setTitle(payload.title);
      if (payload.style) setStyle(payload.style);
      setNotice({ type: "success", message: t("lyricsStudio.noticeLoadedFromTrack") });
    } catch (error) {
      console.error("Failed to load track-edit payload", error);
    }
  }, [setBlocks, setTitle, setStyle]);

  const allPresets = useMemo(() => ({
    ...BLOCK_PRESETS,
    ...customPresets
  }), [customPresets]);

  function handleSaveCurrentStructure(name: string) {
    if (blocks.length === 0) {
      setNotice({ type: "error", message: t("lyricsStudio.noticeAddBlocksFirst") });
      return;
    }
    const types = blocks.map((b) => b.type);
    const next = {
      ...customPresets,
      [name]: types,
    };
    setCustomPresets(next);
    try {
      window.localStorage.setItem("melodiq-custom-presets", JSON.stringify(next));
      setActivePreset(name);
      setNotice({ type: "success", message: t("lyricsStudio.noticePresetSaved", { name }) });
    } catch (error) {
      console.error("Failed to save custom preset", error);
      setNotice({ type: "error", message: t("lyricsStudio.noticePresetSaveFailed") });
    }
  }

  function handleDeleteCustomPreset(name: string) {
    const next = { ...customPresets };
    delete next[name];
    setCustomPresets(next);
    try {
      window.localStorage.setItem("melodiq-custom-presets", JSON.stringify(next));
      setNotice({ type: "info", message: t("lyricsStudio.noticePresetDeleted", { name }) });
      if (activePreset === name) {
        setActivePreset("");
      }
    } catch (error) {
      console.error("Failed to delete custom preset", error);
    }
  }

  const [credits] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatingSong, setGeneratingSong] = useState(false);
  const [showStructureDropdown, setShowStructureDropdown] = useState(false);
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [translationLanguage, setTranslationLanguage] = useState("nl");
  const [customTranslationLanguage, setCustomTranslationLanguage] = useState("");
  const [translatingLyrics, setTranslatingLyrics] = useState(false);
  const [translatingBlockId, setTranslatingBlockId] = useState<string | null>(null);
  const [translatedBlocks, setTranslatedBlocks] = useState<Map<string, string>>(new Map());
  const [showTranslationView, setShowTranslationView] = useState(false);
  const [showLoadSnapshots, setShowLoadSnapshots] = useState(false);
  const [showSaveSnapshotModal, setShowSaveSnapshotModal] = useState(false);
  const [snapshotNameInput, setSnapshotNameInput] = useState("");
  const [saveTitleMode, setSaveTitleMode] = useState(false);
  const [notice, setNotice] = useState<LyricsStudioNotice | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [pendingPresetName, setPendingPresetName] = useState<string | null>(null);

  const songGenerationAbortRef = useRef<AbortController | null>(null);
  const stopSongGenerationRef = useRef(false);

  const {
    draggedBlockId,
    dropTarget,
    startBlockDrag,
    startBlockDragFromCard,
    startBlockMouseDrag,
    handleBlockMouseDragOver,
    handleBlockMouseDrop,
    handleBlockMouseDragEnd,
    onDragHandleMouseDown,
  } = useLyricBlockDrag(setBlocks);

  const isCustomLanguage = language === "Other...";
  const selectedLanguage = isCustomLanguage ? "Other..." : language;
  const effectiveLanguage = isCustomLanguage ? customLanguage.trim() || "Other" : language;
  const temperature = Number((0.1 + ((creativityLevel - 1) / 9) * 1.1).toFixed(2));
  const topP = Number((0.1 + ((contextLevel - 1) / 9) * 0.9).toFixed(2));
  const creativityZone = creativityLevel <= 3 ? t("lyricsStudio.zoneLow") : creativityLevel <= 7 ? t("lyricsStudio.zoneMid") : t("lyricsStudio.zoneHigh");
  const literalnessZone = literalnessLevel <= 3 ? t("lyricsStudio.zonePoetic") : literalnessLevel <= 7 ? t("lyricsStudio.zoneBalanced") : t("lyricsStudio.zoneLiteral");
  const contextZone = contextLevel <= 3 ? t("lyricsStudio.zoneNarrow") : contextLevel <= 7 ? t("lyricsStudio.zoneBalanced") : t("lyricsStudio.zoneWide");
  const canGenerateBlocks = Boolean(topic.trim() && mood.trim() && effectiveLanguage.trim());
  const combinedLyrics = useMemo(() => combineLyrics(blocks), [blocks]);
  const canGenerateTitle = combinedLyrics.trim().length >= 20;
  const effectiveTranslationLanguage =
    translationLanguage === "other"
      ? customTranslationLanguage.trim()
      : TRANSLATION_LANGUAGES.find((item) => item.value === translationLanguage)?.label || "Nederlands (nl)";

  function addBlock(type: BlockType) {
    const existingCount = blocks.filter((b) => b.type === type).length;
    const label = existingCount > 0 ? `${BLOCK_LABELS[type]} ${existingCount + 1}` : BLOCK_LABELS[type];
    setBlocks((current) => [...current, createBlock(type, label)]);
  }

  function updateBlock(id: string, patch: Partial<LyricBlock>) {
    setBlocks((current) => current.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function deleteBlock(id: string) {
    setBlocks((current) => current.filter((b) => b.id !== id));
  }

  function duplicateBlock(id: string) {
    setBlocks((current) => {
      const index = current.findIndex((b) => b.id === id);
      if (index < 0) return current;
      const duplicate: LyricBlock = { ...current[index], id: crypto.randomUUID(), generating: false };
      const next = [...current];
      next.splice(index + 1, 0, duplicate);
      return next;
    });
  }

  function moveBlock(id: string, direction: -1 | 1) {
    setBlocks((current) => {
      const index = current.findIndex((b) => b.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [block] = next.splice(index, 1);
      next.splice(nextIndex, 0, block);
      return next;
    });
  }

  function applyPreset(name: string) {
    if (blocks.length > 0) {
      setPendingPresetName(name);
      setConfirmAction("replaceBlocks");
      return;
    }
    setActivePreset(name);
    setBlocks(createPresetBlocks(allPresets[name], name));
  }

  function formatSnapshotTimestamp(date: Date) {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  }

  function toFileSafeNamePart(value: string) {
    return value
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildSnapshotNameFromTitle(value: string) {
    const base = toFileSafeNamePart(value) || "Untitled";
    return `${base} - ${formatSnapshotTimestamp(new Date())}`;
  }

  function handleSaveLyrics() {
    const trimmedTitle = title.trim();
    if (trimmedTitle) {
      saveLyricsSnapshot(buildSnapshotNameFromTitle(trimmedTitle));
      return;
    }

    setSaveTitleMode(true);
    setSnapshotNameInput("");
    setShowSaveSnapshotModal(true);
  }

  function saveLyricsSnapshot(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNotice({ type: "error", message: t("lyricsStudio.noticeEnterSnapshotName") });
      return;
    }
    const snapshot: LyricStudioSnapshot = {
      id: crypto.randomUUID(),
      name: trimmedName,
      createdAt: new Date().toISOString(),
      payload: buildLyricsStudioDraftPayload({ topic, mood, style, vocalistTag, performerDirections, blocks, activePreset, lyricCols, structure, customStructure, language, customLanguage, repetitiveChorus, creativityLevel, literalnessLevel, contextLevel, styleSuggestion, llmModel }),
    };
    const next = [snapshot, ...savedSnapshots].slice(0, 30);
    setSavedSnapshots(next);
    saveSnapshotsToStorage(next);
    setShowSaveSnapshotModal(false);
    setSaveTitleMode(false);
    setNotice({ type: "success", message: t("lyricsStudio.noticeSnapshotSaved") });
  }

  function loadLyricsSnapshot(snapshot: LyricStudioSnapshot) {
    loadSnapshotIntoState(snapshot, draft, { setStructure, setCustomStructure, setLanguage, setCustomLanguage });
    setShowLoadSnapshots(false);
  }

  function deleteLyricsSnapshot(snapshotId: string) {
    const next = savedSnapshots.filter((s) => s.id !== snapshotId);
    setSavedSnapshots(next);
    saveSnapshotsToStorage(next);
  }

  async function requestBlockLyrics(block: LyricBlock, contextBlocks: LyricBlock[], options?: { chorusMode?: "repeat" | "variation"; isFirstChorus?: boolean }, signal?: AbortSignal) {
    const response = await fetch("/api/lyric-studio/generate-block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        blockType: block.type, blockLabel: block.label, topic, mood,
        language: effectiveLanguage, style,
        vocalistTag, performerDirections,
        existingBlocks: contextBlocks.filter((b) => b.id !== block.id).map(({ type, label, content }) => ({ type, label, content })),
        chorusMode: options?.chorusMode, isFirstChorus: options?.isFirstChorus, temperature, topP,
        llmModel: llmModel.trim() || undefined,
        literalnessLevel,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not generate lyrics");
    return data.result || "";
  }

  async function generateBlock(block: LyricBlock) {
    updateBlock(block.id, { generating: true });
    try {
      const forceUniqueChorus = block.type === "chorus" && repetitiveChorus && block.uniqueChorusOverride;
      const result = await requestBlockLyrics(block, blocks, { chorusMode: repetitiveChorus && !forceUniqueChorus ? "repeat" : "variation" });
      updateBlock(block.id, { content: result, generating: false });
    } catch (error) {
      console.error(error);
      updateBlock(block.id, { generating: false });
      setNotice({ type: "error", message: error instanceof Error ? error.message : t("lyricsStudio.noticeBlockGenerateFailed") });
    }
  }

  const [improvingBlockId, setImprovingBlockId] = useState<string | null>(null);

  async function improveBlockWithLyricIQ(block: LyricBlock) {
    if (!block.content.trim() || improvingBlockId) return;
    setImprovingBlockId(block.id);
    try {
      const response = await fetch("/api/lyric-studio/lyric-iq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockType: block.type,
          blockLabel: block.label,
          lyrics: block.content,
          language: effectiveLanguage,
          topic,
          mood,
          style,
          temperature,
          topP: contextLevel,
          llmModel: llmModel.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "LyricIQ failed");
      if (typeof data.result === "string" && data.result.trim()) {
        updateBlock(block.id, { content: data.result });
      }
    } catch (error) {
      console.error(error);
      setNotice({ type: "error", message: t("lyricsStudio.noticeLyricIQFailed") });
    } finally {
      setImprovingBlockId(null);
    }
  }

  function getGenerationBlocks() {
    if (blocks.length > 0) return blocks;
    if (structure === "manual" && customStructure.trim()) {
      const types = parseStructureText(customStructure);
      if (types.length > 0) return createPresetBlocks(types, activePreset);
    }
    if (structure && structure !== "manual" && structure !== "ai-choose") {
      const selected = STRUCTURES.find((s) => s.value === structure);
      const types = parseStructureText(selected?.label || "");
      if (types.length > 0) return createPresetBlocks(types, STRUCTURE_PRESET_MAP[structure]);
    }
    const presetName = activePreset || STRUCTURE_PRESET_MAP[structure] || "Pop";
    return createPresetBlocks(allPresets[presetName] || allPresets.Pop, presetName);
  }

  const estimatedSongBlockCount = countGeneratableBlocks(getGenerationBlocks(), repetitiveChorus);

  async function generateSongLyrics() {
    if (!canGenerateBlocks || generatingSong) return;
    stopSongGenerationRef.current = false;

    const startingBlocks = getGenerationBlocks();
    if (blocks.length === 0) setBlocks(startingBlocks);
    else setBlocks((current) => current.map((b) => ({ ...b, generating: true })));

    setGeneratingSong(true);

    const generatedBlocks: LyricBlock[] = startingBlocks.map((b) => ({ ...b, content: "", generating: true }));
    let firstChorusContent = "";
    setBlocks(generatedBlocks);

    for (let i = 0; i < generatedBlocks.length; i++) {
      const block = generatedBlocks[i];

      if (stopSongGenerationRef.current) {
        for (let j = i; j < generatedBlocks.length; j++) generatedBlocks[j] = { ...generatedBlocks[j], generating: false };
        setBlocks([...generatedBlocks]);
        break;
      }

      if (block.type === "chorus" && repetitiveChorus && firstChorusContent.trim() && !block.uniqueChorusOverride) {
        generatedBlocks[i] = { ...block, content: firstChorusContent, generating: false };
        setBlocks([...generatedBlocks]);
        continue;
      }

      try {
        const controller = new AbortController();
        songGenerationAbortRef.current = controller;
        const forceUniqueChorus = block.type === "chorus" && repetitiveChorus && block.uniqueChorusOverride;
        const result = await requestBlockLyrics(block, generatedBlocks, {
          chorusMode: repetitiveChorus && !forceUniqueChorus ? "repeat" : "variation",
          isFirstChorus: block.type === "chorus" ? !firstChorusContent.trim() : undefined,
        }, controller.signal);
        songGenerationAbortRef.current = null;
        if (block.type === "chorus" && repetitiveChorus && !firstChorusContent.trim()) firstChorusContent = result;
        generatedBlocks[i] = { ...block, content: result, generating: false };
      } catch (error) {
        songGenerationAbortRef.current = null;
        generatedBlocks[i] = { ...block, generating: false };
        if (stopSongGenerationRef.current) {
          for (let j = i + 1; j < generatedBlocks.length; j++) generatedBlocks[j] = { ...generatedBlocks[j], generating: false };
          setBlocks([...generatedBlocks]);
          break;
        }
        console.error(error);
        setNotice({ type: "error", message: error instanceof Error ? error.message : t("lyricsStudio.noticeSongGenerationError") });
      }

      setBlocks([...generatedBlocks]);
    }

    stopSongGenerationRef.current = false;
    songGenerationAbortRef.current = null;
    setGeneratingSong(false);
  }

  function stopSongGeneration() {
    stopSongGenerationRef.current = true;
    songGenerationAbortRef.current?.abort();
    songGenerationAbortRef.current = null;
  }

  async function copyAllLyrics() {
    try {
      await navigator.clipboard.writeText(combinedLyrics);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice({ type: "error", message: t("lyricsStudio.noticeCopyFailed") });
    }
  }

  async function translateAllLyrics() {
    if (!combinedLyrics.trim() || translatingLyrics) return;
    if (!effectiveTranslationLanguage.trim()) {
      setNotice({ type: "error", message: t("lyricsStudio.noticeChooseTargetLanguage") });
      return;
    }
    setTranslatingLyrics(true);
    try {
      const res = await fetch("/api/lyric-studio/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: effectiveTranslationLanguage, blocks: blocks.map(({ id, type, label, content }) => ({ id, type, label, content })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setNotice({ type: "error", message: data?.error || t("lyricsStudio.noticeTranslationFailed") }); return; }
      if (!Array.isArray(data?.blocks)) { setNotice({ type: "error", message: t("lyricsStudio.noticeTranslationInvalidResponse") }); return; }
      const map = new Map<string, string>();
      for (const item of data.blocks) {
        if (typeof item?.id === "string" && typeof item?.content === "string") map.set(item.id, item.content);
      }
      setTranslatedBlocks(map);
      setShowTranslationView(true);
      setNotice({ type: "success", message: t("lyricsStudio.noticeTranslated", { language: effectiveTranslationLanguage }) });
    } catch {
      setNotice({ type: "error", message: t("lyricsStudio.noticeTranslationFailed") });
    } finally {
      setTranslatingLyrics(false);
    }
  }

  async function translateBlock(blockId: string) {
    if (translatingBlockId) return;
    const block = blocks.find((b) => b.id === blockId);
    if (!block || !block.content.trim()) return;
    if (!effectiveTranslationLanguage.trim()) { setNotice({ type: "error", message: t("lyricsStudio.noticeChooseTargetLanguage") }); return; }
    setTranslatingBlockId(blockId);
    try {
      const res = await fetch("/api/lyric-studio/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: effectiveTranslationLanguage, blocks: [{ id: block.id, type: block.type, label: block.label, content: block.content }] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setNotice({ type: "error", message: data?.error || t("lyricsStudio.noticeTranslationFailed") }); return; }
      if (!Array.isArray(data?.blocks) || !data.blocks[0]) { setNotice({ type: "error", message: t("lyricsStudio.noticeTranslationInvalidResponse") }); return; }
      setTranslatedBlocks(new Map([[blockId, data.blocks[0].content]]));
      setShowTranslationView(true);
    } catch {
      setNotice({ type: "error", message: t("lyricsStudio.noticeTranslationFailed") });
    } finally {
      setTranslatingBlockId(null);
    }
  }

  function useInStudio() {
    const nextLyrics = combinedLyrics.trim();
    if (!nextLyrics) return;
    sessionStorage.setItem("lyrics-studio-payload", JSON.stringify({ lyrics: nextLyrics, style: "", title: title.trim() }));
    router.push("/studio");
  }

  function goToMelody() {
    router.push("/melody");
  }

  async function generateTitleFromLyrics() {
    if (!canGenerateTitle || generatingTitle) return;
    setGeneratingTitle(true);
    try {
      const res = await fetch("/api/generate-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics: combinedLyrics }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ type: "error", message: data?.error || t("lyricsStudio.noticeTitleGenerateFailed") });
        return;
      }

      const nextTitle = typeof data?.title === "string" ? data.title.trim() : "";
      if (!nextTitle) {
        setNotice({ type: "error", message: t("lyricsStudio.noticeTitleInvalid") });
        return;
      }

      setTitle(nextTitle);
      setNotice({ type: "success", message: t("lyricsStudio.noticeTitleGenerated") });
      return nextTitle;
    } catch {
      setNotice({ type: "error", message: t("lyricsStudio.noticeTitleGenerateFailed") });
    } finally {
      setGeneratingTitle(false);
    }
  }

  async function generateTitleAndSaveLyrics() {
    if (!canGenerateTitle) {
      setNotice({ type: "error", message: t("lyricsStudio.noticeAddMoreLyricsForTitle") });
      return;
    }
    const nextTitle = await generateTitleFromLyrics();
    if (!nextTitle) return;
    saveLyricsSnapshot(buildSnapshotNameFromTitle(nextTitle));
  }

  function saveLyricsWithManualTitleInput() {
    const nextTitle = snapshotNameInput.trim();
    if (!nextTitle) {
      setNotice({ type: "error", message: t("lyricsStudio.noticeEnterTitleFirst") });
      return;
    }
    setTitle(nextTitle);
    saveLyricsSnapshot(buildSnapshotNameFromTitle(nextTitle));
  }

  function clearAllDraft(force = false) {
    if (!force) { setConfirmAction("clearAll"); return; }
    setTopic(""); setMood(""); setStyle(""); setBlocks([]); setActivePreset("");
    setLyricCols(2); setShowStructureDropdown(false);
    setStructure(""); setCustomStructure(""); setRepetitiveChorus(true);
    setTitle("");
    setCreativityLevel(5); setLiteralnessLevel(5); setContextLevel(5); setLanguage("English"); setCustomLanguage("");
    setLlmModel(""); setVocalistTag("auto");
    setStyleSuggestion(""); setShowLoadSnapshots(false);
    window.localStorage.removeItem("melodiq-lyrics-studio");
    setNotice({ type: "info", message: t("lyricsStudio.noticeCleared") });
  }

  function handleConfirmAction() {
    if (confirmAction === "replaceBlocks" && pendingPresetName) {
      setActivePreset(pendingPresetName);
      setBlocks(createPresetBlocks(allPresets[pendingPresetName], pendingPresetName));
      setPendingPresetName(null);
    } else if (confirmAction === "clearAll") {
      clearAllDraft(true);
    }
    setConfirmAction(null);
  }

  return (
    <div className="flex h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] bg-[#0d0d12] text-white overflow-hidden" style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}>
      <Sidebar credits={credits} />

      <main className="flex-1 flex flex-col overflow-hidden pt-[65px] lg:pt-0">
        <div className="flex-1 overflow-y-auto">
          <div className="w-full px-4 py-6 lg:px-6 lg:py-8">
            <LyricsNotice notice={notice} onClose={() => setNotice(null)} />

            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold mb-2">{t("studio.lyrics")}</h1>
                <p className="text-white/60">{t("lyricsStudio.subtitle")}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleSaveLyrics} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white">
                  {t("studio.saveLyrics")}
                </button>
                <button type="button" onClick={() => setShowLoadSnapshots(true)} disabled={savedSnapshots.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  {t("lyricsStudio.loadLyrics")}
                </button>
                <button type="button" onClick={() => clearAllDraft()} className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20">
                  {t("lyricsStudio.clearAllButton")}
                </button>
              </div>
            </div>

            <LyricsSnapshotModals
              showLoadSnapshots={showLoadSnapshots}
              showSaveSnapshotModal={showSaveSnapshotModal}
              savedSnapshots={savedSnapshots}
              snapshotNameInput={snapshotNameInput}
              onCloseLoad={() => setShowLoadSnapshots(false)}
              onCloseSave={() => { setShowSaveSnapshotModal(false); setSaveTitleMode(false); }}
              onSnapshotNameChange={setSnapshotNameInput}
              onLoadSnapshot={loadLyricsSnapshot}
              onDeleteSnapshot={deleteLyricsSnapshot}
              titleMode={saveTitleMode}
              generatingTitle={generatingTitle}
              onGenerateTitle={generateTitleAndSaveLyrics}
              onSaveSnapshot={saveTitleMode ? saveLyricsWithManualTitleInput : () => saveLyricsSnapshot(snapshotNameInput)}
            />

            <LyricsConfirmModal
              confirmAction={confirmAction}
              onConfirm={handleConfirmAction}
              onCancel={() => { setConfirmAction(null); setPendingPresetName(null); }}
            />

            <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)_320px]">
              <LyricsControlPanel
                topic={topic} mood={mood} style={style}
                vocalistTag={vocalistTag} performerDirections={performerDirections}
                titleValue={title}
                generatingTitle={generatingTitle}
                canGenerateTitle={canGenerateTitle}
                selectedLanguage={selectedLanguage} isCustomLanguage={isCustomLanguage}
                customLanguage={customLanguage} structure={structure} customStructure={customStructure}
                showStructureDropdown={showStructureDropdown} activePreset={activePreset}
                repetitiveChorus={repetitiveChorus} creativityLevel={creativityLevel}
                creativityZone={creativityZone} temperature={temperature}
                literalnessLevel={literalnessLevel} literalnessZone={literalnessZone}
                onLiteralnessLevelChange={setLiteralnessLevel}
                contextLevel={contextLevel} contextZone={contextZone} topP={topP}
                llmModel={llmModel} onLlmModelChange={setLlmModel}
                estimatedSongBlockCount={estimatedSongBlockCount}
                canGenerateBlocks={canGenerateBlocks} generatingSong={generatingSong}
                blockTypes={BLOCK_TYPES} blockLabels={BLOCK_LABELS} blockColors={BLOCK_COLORS}
                presets={allPresets} combinedLyrics={combinedLyrics} copied={copied}
                onTopicChange={setTopic} onMoodChange={setMood} onStyleChange={setStyle}
                onVocalistTagChange={setVocalistTag} onPerformerDirectionsChange={setPerformerDirections}
                onTitleChange={setTitle}
                onGenerateTitle={generateTitleFromLyrics}
                onLanguageChange={setLanguage} onCustomLanguageChange={setCustomLanguage}
                onStructureChange={setStructure} onCustomStructureChange={setCustomStructure}
                onToggleStructureDropdown={() => setShowStructureDropdown((v) => !v)}
                onStructureDropdownClose={() => setShowStructureDropdown(false)}
                onPresetApply={applyPreset}
                onActivePresetClear={() => { setStructure(""); setCustomStructure(""); setActivePreset(""); }}
                onRepetitiveChorusChange={setRepetitiveChorus}
                onCreativityLevelChange={setCreativityLevel}
                onContextLevelChange={setContextLevel}
                onGenerateSong={generateSongLyrics}
                onStopGenerating={stopSongGeneration}
                onAddBlock={addBlock}
                onClearAll={() => clearAllDraft()}
                onCopyAll={copyAllLyrics}
                onSaveCurrentStructure={handleSaveCurrentStructure}
                onDeleteCustomPreset={handleDeleteCustomPreset}
              />

              <section className="min-h-[620px] rounded-2xl border border-white/10 bg-[#101018]/80 p-4 lg:p-5">
                {showTranslationView ? (
                  <TranslationReview
                    blocks={blocks}
                    translatedBlocks={translatedBlocks}
                    effectiveTranslationLanguage={effectiveTranslationLanguage}
                    onUseTranslation={(blockId, translated) => {
                      setBlocks((current) => current.map((b) => (b.id === blockId ? { ...b, content: translated } : b)));
                      const next = new Map(translatedBlocks);
                      next.delete(blockId);
                      setTranslatedBlocks(next);
                    }}
                    onKeepOriginal={(blockId) => {
                      const next = new Map(translatedBlocks);
                      next.delete(blockId);
                      setTranslatedBlocks(next);
                    }}
                    onKeepBoth={(blockId, original, translated) => {
                      setBlocks((current) => current.map((b) => b.id === blockId ? { ...b, content: `${original}\n\n---\n\n${translated}` } : b));
                      const next = new Map(translatedBlocks);
                      next.delete(blockId);
                      setTranslatedBlocks(next);
                    }}
                    onDone={() => setShowTranslationView(false)}
                  />
                ) : (
                  <LyricBlockEditor
                    blocks={blocks} lyricCols={lyricCols} setLyricCols={setLyricCols}
                    blockColors={BLOCK_COLORS} blockLabels={BLOCK_LABELS}
                    draggedBlockId={draggedBlockId} dropTarget={dropTarget}
                    canGenerateBlocks={canGenerateBlocks} translatingBlockId={translatingBlockId}
                    effectiveTranslationLanguage={effectiveTranslationLanguage}
                    improvingBlockId={improvingBlockId}
                    onStartBlockDrag={startBlockDrag}
                    onStartBlockDragFromCard={startBlockDragFromCard}
                    onStartBlockMouseDrag={startBlockMouseDrag}
                    onDragHandleMouseDown={onDragHandleMouseDown}
                    onBlockMouseDragOver={handleBlockMouseDragOver}
                    onBlockMouseDrop={handleBlockMouseDrop}
                    onBlockMouseDragEnd={handleBlockMouseDragEnd}
                    onMoveBlock={moveBlock} onDuplicateBlock={duplicateBlock}
                    onDeleteBlock={deleteBlock} onUpdateBlock={updateBlock}
                    onGenerateBlock={generateBlock} onTranslateBlock={translateBlock}
                    onImproveBlock={improveBlockWithLyricIQ}
                    autoGrowTextarea={autoGrowTextarea}
                  />
                )}

                <LyricsBottomActions
                  translationLanguage={translationLanguage}
                  customTranslationLanguage={customTranslationLanguage}
                  combinedLyrics={combinedLyrics}
                  onTranslationLanguageChange={setTranslationLanguage}
                  onCustomTranslationLanguageChange={setCustomTranslationLanguage}
                  onGoToMusic={useInStudio}
                  onGoToMelody={goToMelody}
                />
              </section>

              <aside className="hidden lg:block">
                <div className="min-h-[620px] rounded-2xl border border-white/10 bg-[#181820]/80 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white/70">{t("studio.lyrics")}</h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={translateAllLyrics}
                        disabled={
                          !combinedLyrics ||
                          translatingLyrics ||
                          (translationLanguage === "other" && !customTranslationLanguage.trim())
                        }
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                        title={t("lyricsStudio.translateTooltip")}
                      >
                        {translatingLyrics ? t("lyricsStudio.translatingButton") : t("lyricsStudio.translateButton")}
                      </button>
                      <button
                        type="button"
                        onClick={copyAllLyrics}
                        disabled={!combinedLyrics}
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {copied ? t("lyricsStudio.copiedButton") : t("lyricsStudio.copyButton")}
                      </button>
                    </div>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-5 text-white/90">{combinedLyrics || t("lyricsStudio.noLyricsPlaceholder")}</pre>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
