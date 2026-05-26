"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import CollapsibleSidebar from "@/components/CollapsibleSidebar";
import LyricsBottomActions from "@/components/lyrics-studio/LyricsBottomActions";
import LyricBlockEditor from "@/components/lyrics-studio/LyricBlockEditor";
import LyricsConfirmModal from "@/components/lyrics-studio/LyricsConfirmModal";
import LyricsControlPanel from "@/components/lyrics-studio/LyricsControlPanel";
import LyricsNotice from "@/components/lyrics-studio/LyricsNotice";
import LyricsSnapshotModals from "@/components/lyrics-studio/LyricsSnapshotModals";
import LyricsStudioSidePanel from "@/components/lyrics-studio/LyricsStudioSidePanel";
import TranslationReview from "@/components/lyrics-studio/TranslationReview";
import {
  BLOCK_COLORS,
  BLOCK_PRESETS,
  BLOCK_TYPES,
  STRUCTURES,
  STRUCTURE_PRESET_MAP,
  TRANSLATION_LANGUAGES,
} from "@/lib/lyrics-studio-constants";
import {
  buildLyricsStudioDraftPayload,
  parseSavedLyricsSnapshots,
  sanitizeLyricBlocksForLoad,
} from "@/lib/lyrics-studio-draft";
import {
  type ConfirmAction,
  type LyricsStudioNotice,
  type LyricStudioSnapshot,
} from "@/lib/lyrics-studio-types";
import {
  autoGrowTextarea,
  BLOCK_LABELS,
  combineLyrics,
  createBlock,
  createPresetBlocks,
  parseStructureText,
  type BlockType,
  type LyricBlock,
} from "@/lib/lyrics-utils";
import { useStudioStore } from "@/lib/store";

const LYRICS_STUDIO_STORAGE_KEY = "sonara-lyrics-studio";
const LYRICS_STUDIO_SNAPSHOTS_KEY = "sonara-lyrics-studio-snapshots";

export default function LyricsStudioPage() {
  const [showLyricsSidebar, setShowLyricsSidebar] = useState(false);
  const [lyricCols, setLyricCols] = useState(2); // 1 of 2 kolommen
  const router = useRouter();
  const [credits] = useState<number | null>(null);
  const [topic, setTopic] = useState("");
  const [mood, setMood] = useState("");
  const [style, setStyle] = useState("");
  const [blocks, setBlocks] = useState<LyricBlock[]>([]);
  const [copied, setCopied] = useState(false);
  const [activePreset, setActivePreset] = useState("");
  const [generatingSong, setGeneratingSong] = useState(false);
  const [showStructureDropdown, setShowStructureDropdown] = useState(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [repetitiveChorus, setRepetitiveChorus] = useState(true);
  const [creativityLevel, setCreativityLevel] = useState(5);
  const [contextLevel, setContextLevel] = useState(5);
  const [styleSuggestion, setStyleSuggestion] = useState("");
  const [generatingStyleSuggestion, setGeneratingStyleSuggestion] = useState(false);
  const [copiedStyleSuggestion, setCopiedStyleSuggestion] = useState(false);
  const [translationLanguage, setTranslationLanguage] = useState("nl");
  const [customTranslationLanguage, setCustomTranslationLanguage] = useState("");
  const [translatingLyrics, setTranslatingLyrics] = useState(false);
  const [translatingBlockId, setTranslatingBlockId] = useState<string | null>(null);
  const [translatedBlocks, setTranslatedBlocks] = useState<Map<string, string>>(new Map());
  const [showTranslationView, setShowTranslationView] = useState(false);
  const [savedSnapshots, setSavedSnapshots] = useState<LyricStudioSnapshot[]>([]);
  const [showLoadSnapshots, setShowLoadSnapshots] = useState(false);
  const [showSaveSnapshotModal, setShowSaveSnapshotModal] = useState(false);
  const [snapshotNameInput, setSnapshotNameInput] = useState("");
  const [notice, setNotice] = useState<LyricsStudioNotice | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [pendingPresetName, setPendingPresetName] = useState<string | null>(null);
  const [pendingStudioPayload, setPendingStudioPayload] = useState<{ lyrics: string; style: string } | null>(null);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: "before" | "after" } | null>(null);
  const songGenerationAbortRef = useRef<AbortController | null>(null);
  const stopSongGenerationRef = useRef(false);
  const dragStateRef = useRef<{ pointerId: number; blockId: string } | null>(null);
  const dropTargetRef = useRef<{ id: string; position: "before" | "after" } | null>(null);
  const {
    language,
    customLanguage,
    structure,
    customStructure,
    setLanguage,
    setCustomLanguage,
    setStructure,
    setCustomStructure,
  } = useStudioStore();

  useEffect(() => {
    useStudioStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LYRICS_STUDIO_STORAGE_KEY);
      if (!raw) {
        setHasRestoredDraft(true);
        return;
      }

      const parsed = JSON.parse(raw) as {
        topic?: string;
        mood?: string;
        style?: string;
        blocks?: Array<Partial<LyricBlock>>;
        activePreset?: string;
        lyricCols?: number;
        showLyricsSidebar?: boolean;
        structure?: string;
        customStructure?: string;
        language?: string;
        customLanguage?: string;
        repetitiveChorus?: boolean;
        creativityLevel?: number;
        contextLevel?: number;
        styleSuggestion?: string;
      };

      if (typeof parsed.topic === "string") setTopic(parsed.topic);
      if (typeof parsed.mood === "string") setMood(parsed.mood);
      if (typeof parsed.style === "string") setStyle(parsed.style);
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
        const restoredBlocks: LyricBlock[] = parsed.blocks
          .filter((block): block is Partial<LyricBlock> & { type: BlockType } => !!block?.type && validTypes.has(block.type as BlockType))
          .map((block, index) => ({
            id: typeof block.id === "string" && block.id.trim() ? block.id : `restored-${index}-${crypto.randomUUID()}`,
            type: block.type,
            label: typeof block.label === "string" && block.label.trim() ? block.label : BLOCK_LABELS[block.type],
            content: typeof block.content === "string" ? block.content : "",
            generating: false,
            uniqueChorusOverride:
              block.type === "chorus" && typeof block.uniqueChorusOverride === "boolean"
                ? block.uniqueChorusOverride
                : false,
          }));
        setBlocks(restoredBlocks);
      }
    } catch {
      window.localStorage.removeItem(LYRICS_STUDIO_STORAGE_KEY);
    } finally {
      setHasRestoredDraft(true);
    }
  }, [setCustomLanguage, setCustomStructure, setLanguage, setStructure]);

  useEffect(() => {
    const raw = window.localStorage.getItem(LYRICS_STUDIO_SNAPSHOTS_KEY);
    setSavedSnapshots(parseSavedLyricsSnapshots(raw));
  }, []);

  useEffect(() => {
    if (!hasRestoredDraft) return;

    const payload = buildLyricsStudioDraftPayload({
      topic,
      mood,
      style,
      blocks,
      activePreset,
      lyricCols,
      showLyricsSidebar,
      structure,
      customStructure,
      language,
      customLanguage,
      repetitiveChorus,
      creativityLevel,
      contextLevel,
      styleSuggestion,
    });

    window.localStorage.setItem(LYRICS_STUDIO_STORAGE_KEY, JSON.stringify(payload));
  }, [
    activePreset,
    blocks,
    customLanguage,
    customStructure,
    hasRestoredDraft,
    language,
    lyricCols,
    mood,
    repetitiveChorus,
    creativityLevel,
    contextLevel,
    showLyricsSidebar,
    styleSuggestion,
    structure,
    style,
    topic,
  ]);

  const isCustomLanguage = language === "Other...";
  const selectedLanguage = isCustomLanguage ? "Other..." : language;
  const effectiveLanguage = isCustomLanguage ? customLanguage.trim() || "Other" : language;
  const temperature = Number((0.1 + ((creativityLevel - 1) / 9) * 1.1).toFixed(2));
  const topP = Number((0.1 + ((contextLevel - 1) / 9) * 0.9).toFixed(2));
  const creativityZone = creativityLevel <= 3 ? "Laag" : creativityLevel <= 7 ? "Middel" : "Hoog";
  const contextZone = contextLevel <= 3 ? "Smal" : contextLevel <= 7 ? "Gebalanceerd" : "Breed";
  const canGenerateBlocks = Boolean(topic.trim() && mood.trim() && effectiveLanguage.trim());
  const combinedLyrics = useMemo(() => combineLyrics(blocks), [blocks]);
  const effectiveTranslationLanguage =
    translationLanguage === "other"
      ? customTranslationLanguage.trim()
      : TRANSLATION_LANGUAGES.find((item) => item.value === translationLanguage)?.label || "Nederlands (nl)";

  function addBlock(type: BlockType) {
    const existingCount = blocks.filter((block) => block.type === type).length;
    const label = existingCount > 0 ? `${BLOCK_LABELS[type]} ${existingCount + 1}` : BLOCK_LABELS[type];
    setBlocks((current) => [...current, createBlock(type, label)]);
  }

  function updateBlock(id: string, patch: Partial<LyricBlock>) {
    setBlocks((current) =>
      current.map((block) => (block.id === id ? { ...block, ...patch } : block))
    );
  }

  function deleteBlock(id: string) {
    setBlocks((current) => current.filter((block) => block.id !== id));
  }

  function duplicateBlock(id: string) {
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === id);
      if (index < 0) return current;

      const original = current[index];
      const duplicate: LyricBlock = {
        ...original,
        id: crypto.randomUUID(),
        generating: false,
      };
      const next = [...current];
      next.splice(index + 1, 0, duplicate);
      return next;
    });
  }

  function moveBlock(id: string, direction: -1 | 1) {
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;

      const next = [...current];
      const [block] = next.splice(index, 1);
      next.splice(nextIndex, 0, block);
      return next;
    });
  }

  function updateDragTarget(clientX: number, clientY: number, draggingId: string) {
    // Try elementFromPoint first - works in most cases
    let blockElement: HTMLElement | null = null;
    try {
      const hoveredElement = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      blockElement = hoveredElement?.closest<HTMLElement>("[data-lyric-block-id]") ?? null;
    } catch {
      // elementFromPoint may fail during pointer capture, try alternative approach
    }

    // If elementFromPoint didn't work, scan visible blocks
    if (!blockElement) {
      const allBlocks = Array.from(document.querySelectorAll("[data-lyric-block-id]")) as HTMLElement[];
      for (const block of allBlocks) {
        const rect = block.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
          blockElement = block;
          break;
        }
      }
    }

    const targetId = blockElement?.dataset.lyricBlockId;
    if (!targetId || targetId === draggingId || !blockElement) {
      dropTargetRef.current = null;
      setDropTarget(null);
      return;
    }

    const rect = blockElement.getBoundingClientRect();
    const position = clientY < rect.top + rect.height / 2 ? "before" : "after";
    dropTargetRef.current = { id: targetId, position };
    setDropTarget({ id: targetId, position });
  }

  function shouldIgnoreDragStart(target: EventTarget | null) {
    const element = target instanceof HTMLElement ? target : null;
    return Boolean(element?.closest("input, textarea, button, select, option, label, a"));
  }

  function startBlockDrag(event: React.PointerEvent<HTMLButtonElement>, blockId: string) {
    event.preventDefault();
    event.stopPropagation();

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}

    dragStateRef.current = { pointerId: event.pointerId, blockId };
    setDraggedBlockId(blockId);
    setDropTarget(null);
  }

  function startBlockDragFromCard(event: React.PointerEvent<HTMLElement>, blockId: string) {
    if (shouldIgnoreDragStart(event.target)) return;
    event.preventDefault();
    event.stopPropagation();

    const element = event.currentTarget;
    try {
      element.setPointerCapture(event.pointerId);
    } catch {}

    dragStateRef.current = { pointerId: event.pointerId, blockId };
    setDraggedBlockId(blockId);
    setDropTarget(null);
  }

  useEffect(() => {
    if (!draggedBlockId) return;

    function handlePointerMove(event: PointerEvent) {
      if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) return;
      updateDragTarget(event.clientX, event.clientY, dragStateRef.current.blockId);
    }

    function finishDrag(event: PointerEvent) {
      if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) return;

      const activeDrag = dragStateRef.current;
      const currentDropTarget = dropTargetRef.current;

      if (currentDropTarget) {
        setBlocks((currentBlocks) => {
          const targetIndex = currentBlocks.findIndex((block) => block.id === currentDropTarget.id);
          if (targetIndex >= 0) {
            const fromIndex = currentBlocks.findIndex((block) => block.id === activeDrag.blockId);
            if (fromIndex >= 0) {
              const boundedInsertionIndex = Math.max(0, Math.min(
                currentDropTarget.position === "before" ? targetIndex : targetIndex + 1,
                currentBlocks.length
              ));
              const adjustedInsertionIndex = fromIndex < boundedInsertionIndex
                ? boundedInsertionIndex - 1
                : boundedInsertionIndex;

              if (adjustedInsertionIndex !== fromIndex) {
                const next = [...currentBlocks];
                const [block] = next.splice(fromIndex, 1);
                next.splice(adjustedInsertionIndex, 0, block);
                return next;
              }
            }
          }
          return currentBlocks;
        });
      }

      dragStateRef.current = null;
      dropTargetRef.current = null;
      setDraggedBlockId(null);
      setDropTarget(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [draggedBlockId]);

  function applyPreset(name: string) {
    if (blocks.length > 0) {
      setPendingPresetName(name);
      setConfirmAction("replaceBlocks");
      return;
    }
    setActivePreset(name);
    setBlocks(createPresetBlocks(BLOCK_PRESETS[name], name));
  }

  function openSaveSnapshotModal() {
    setSnapshotNameInput(`Lyrics ${new Date().toLocaleString()}`);
    setShowSaveSnapshotModal(true);
  }

  function saveLyricsSnapshot(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNotice({ type: "error", message: "Geef een snapshot-naam op." });
      return;
    }

    const snapshot: LyricStudioSnapshot = {
      id: crypto.randomUUID(),
      name: trimmedName,
      createdAt: new Date().toISOString(),
      payload: buildLyricsStudioDraftPayload({
        topic,
        mood,
        style,
        blocks,
        activePreset,
        lyricCols,
        showLyricsSidebar,
        structure,
        customStructure,
        language,
        customLanguage,
        repetitiveChorus,
        creativityLevel,
        contextLevel,
        styleSuggestion,
      }),
    };

    const next = [snapshot, ...savedSnapshots].slice(0, 30);
    setSavedSnapshots(next);
    window.localStorage.setItem(LYRICS_STUDIO_SNAPSHOTS_KEY, JSON.stringify(next));
    setShowSaveSnapshotModal(false);
    setNotice({ type: "success", message: "Lyrics snapshot opgeslagen." });
  }

  function loadLyricsSnapshot(snapshot: LyricStudioSnapshot) {
    const payload = snapshot.payload;
    setTopic(payload.topic || "");
    setMood(payload.mood || "");
    setStyle(payload.style || "");
    setBlocks(sanitizeLyricBlocksForLoad(payload.blocks || [], BLOCK_TYPES, BLOCK_LABELS));
    setActivePreset(payload.activePreset || "");
    setLyricCols(payload.lyricCols === 1 ? 1 : 2);
    setShowLyricsSidebar(Boolean(payload.showLyricsSidebar));
    setStructure(payload.structure || "");
    setCustomStructure(payload.customStructure || "");
    setLanguage(payload.language || "English");
    setCustomLanguage(payload.customLanguage || "");
    setRepetitiveChorus(typeof payload.repetitiveChorus === "boolean" ? payload.repetitiveChorus : true);
    setCreativityLevel(
      typeof payload.creativityLevel === "number" && payload.creativityLevel >= 1 && payload.creativityLevel <= 10
        ? Math.round(payload.creativityLevel)
        : 5
    );
    setContextLevel(
      typeof payload.contextLevel === "number" && payload.contextLevel >= 1 && payload.contextLevel <= 10
        ? Math.round(payload.contextLevel)
        : 7
    );
    setStyleSuggestion(payload.styleSuggestion || "");
    setShowLoadSnapshots(false);
  }

  function deleteLyricsSnapshot(snapshotId: string) {
    const next = savedSnapshots.filter((snapshot) => snapshot.id !== snapshotId);
    setSavedSnapshots(next);
    window.localStorage.setItem(LYRICS_STUDIO_SNAPSHOTS_KEY, JSON.stringify(next));
  }

  async function requestBlockLyrics(
    block: LyricBlock,
    contextBlocks: LyricBlock[],
    options?: { chorusMode?: "repeat" | "variation"; isFirstChorus?: boolean },
    signal?: AbortSignal
  ) {
    const response = await fetch("/api/lyric-studio/generate-block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        blockType: block.type,
        blockLabel: block.label,
        topic,
        mood,
        language: effectiveLanguage,
        style,
        existingBlocks: contextBlocks
          .filter((existingBlock) => existingBlock.id !== block.id)
          .map(({ type, label, content }) => ({ type, label, content })),
        chorusMode: options?.chorusMode,
        isFirstChorus: options?.isFirstChorus,
        temperature,
        topP,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Could not generate lyrics");
    }

    return data.result || "";
  }

  async function generateBlock(block: LyricBlock) {
    updateBlock(block.id, { generating: true });

    try {
      const forceUniqueChorus =
        block.type === "chorus" && repetitiveChorus && block.uniqueChorusOverride;
      const result = await requestBlockLyrics(block, blocks, {
        chorusMode: repetitiveChorus && !forceUniqueChorus ? "repeat" : "variation",
      });
      updateBlock(block.id, { content: result, generating: false });
    } catch (error) {
      console.error(error);
      updateBlock(block.id, { generating: false });
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Kon dit blok niet genereren.",
      });
    }
  }

  function getGenerationBlocks() {
    if (blocks.length > 0) return blocks;

    if (structure === "manual" && customStructure.trim()) {
      const manualTypes = parseStructureText(customStructure);
      if (manualTypes.length > 0) {
        return createPresetBlocks(manualTypes, activePreset);
      }
    }

    if (structure && structure !== "manual" && structure !== "ai-choose") {
      const selectedStructure = STRUCTURES.find((item) => item.value === structure);
      const structureTypes = parseStructureText(selectedStructure?.label || "");
      if (structureTypes.length > 0) {
        return createPresetBlocks(structureTypes, STRUCTURE_PRESET_MAP[structure]);
      }
    }

    const presetName = activePreset || STRUCTURE_PRESET_MAP[structure] || "Pop";
    const presetTypes = BLOCK_PRESETS[presetName] || BLOCK_PRESETS.Pop;
    return createPresetBlocks(presetTypes, presetName);
  }

  async function generateSongLyrics() {
    if (!canGenerateBlocks || generatingSong) return;

    stopSongGenerationRef.current = false;

    const startingBlocks = getGenerationBlocks();
    if (blocks.length === 0) {
      setBlocks(startingBlocks);
    } else {
      setBlocks((current) => current.map((block) => ({ ...block, generating: true })));
    }

    setGeneratingSong(true);

    const generatedBlocks: LyricBlock[] = startingBlocks.map((block) => ({
      ...block,
      content: "",
      generating: true,
    }));

    let firstChorusContent = "";

    setBlocks(generatedBlocks);

    for (let index = 0; index < generatedBlocks.length; index += 1) {
      const block = generatedBlocks[index];

      if (stopSongGenerationRef.current) {
        for (let i = index; i < generatedBlocks.length; i += 1) {
          generatedBlocks[i] = {
            ...generatedBlocks[i],
            generating: false,
          };
        }
        setBlocks([...generatedBlocks]);
        break;
      }

      if (block.type === "chorus" && repetitiveChorus && firstChorusContent.trim() && !block.uniqueChorusOverride) {
        generatedBlocks[index] = {
          ...block,
          content: firstChorusContent,
          generating: false,
        };
        setBlocks([...generatedBlocks]);
        continue;
      }

      try {
        const controller = new AbortController();
        songGenerationAbortRef.current = controller;

        const forceUniqueChorus =
          block.type === "chorus" && repetitiveChorus && block.uniqueChorusOverride;

        const result = await requestBlockLyrics(block, generatedBlocks, {
          chorusMode: repetitiveChorus && !forceUniqueChorus ? "repeat" : "variation",
          isFirstChorus: block.type === "chorus" ? !firstChorusContent.trim() : undefined,
        }, controller.signal);

        songGenerationAbortRef.current = null;

        if (block.type === "chorus" && repetitiveChorus && !firstChorusContent.trim()) {
          firstChorusContent = result;
        }

        generatedBlocks[index] = {
          ...block,
          content: result,
          generating: false,
        };
      } catch (error) {
        songGenerationAbortRef.current = null;

        if (stopSongGenerationRef.current) {
          generatedBlocks[index] = {
            ...block,
            generating: false,
          };

          for (let i = index + 1; i < generatedBlocks.length; i += 1) {
            generatedBlocks[i] = {
              ...generatedBlocks[i],
              generating: false,
            };
          }

          setBlocks([...generatedBlocks]);
          break;
        }

        console.error(error);
        generatedBlocks[index] = {
          ...block,
          generating: false,
        };
        setNotice({
          type: "error",
          message: error instanceof Error ? error.message : "Fout tijdens songgeneratie.",
        });
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
      setNotice({ type: "error", message: "Kopieren mislukt. Probeer opnieuw." });
    }
  }

  async function translateAllLyrics() {
    if (!combinedLyrics.trim() || translatingLyrics) return;
    if (!effectiveTranslationLanguage.trim()) {
      setNotice({ type: "error", message: "Kies eerst een doeltaal." });
      return;
    }

    setTranslatingLyrics(true);
    try {
      const response = await fetch("/api/lyric-studio/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLanguage: effectiveTranslationLanguage,
          blocks: blocks.map(({ id, type, label, content }) => ({ id, type, label, content })),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice({ type: "error", message: data?.error || "Vertalen is mislukt." });
        return;
      }

      if (!Array.isArray(data?.blocks)) {
        setNotice({ type: "error", message: "Vertaling gaf een ongeldig antwoord." });
        return;
      }

      const translatedById = new Map<string, string>();
      for (const item of data.blocks) {
        if (typeof item?.id === "string" && typeof item?.content === "string") {
          translatedById.set(item.id, item.content);
        }
      }

      setTranslatedBlocks(translatedById);
      setShowTranslationView(true);
      setNotice({ type: "success", message: `Lyrics vertaald naar ${effectiveTranslationLanguage}.` });
    } catch {
      setNotice({ type: "error", message: "Vertalen is mislukt." });
    } finally {
      setTranslatingLyrics(false);
    }
  }

  async function translateBlock(blockId: string) {
    if (translatingBlockId) return;
    
    const block = blocks.find((b) => b.id === blockId);
    if (!block || !block.content.trim()) return;
    
    if (!effectiveTranslationLanguage.trim()) {
      setNotice({ type: "error", message: "Kies eerst een doeltaal." });
      return;
    }

    setTranslatingBlockId(blockId);
    try {
      const response = await fetch("/api/lyric-studio/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLanguage: effectiveTranslationLanguage,
          blocks: [{ id: block.id, type: block.type, label: block.label, content: block.content }],
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice({ type: "error", message: data?.error || "Vertalen is mislukt." });
        return;
      }

      if (!Array.isArray(data?.blocks) || !data.blocks[0]) {
        setNotice({ type: "error", message: "Vertaling gaf een ongeldig antwoord." });
        return;
      }

      const translatedContent = data.blocks[0].content;
      setTranslatedBlocks(new Map([[blockId, translatedContent]]));
      setShowTranslationView(true);
    } catch {
      setNotice({ type: "error", message: "Vertalen is mislukt." });
    } finally {
      setTranslatingBlockId(null);
    }
  }

  function useInStudio() {
    useStudioStore.getState().setLyrics(combinedLyrics);
    router.push("/");
  }

  function useLyricsAndStyleInStudio() {
    const nextLyrics = combinedLyrics.trim();
    const nextStyle = (styleSuggestion.trim() || style.trim()).trim();
    if (!nextLyrics || !nextStyle) return;

    const studio = useStudioStore.getState();
    const hasExistingStudioData = Boolean(
      studio.songIdea.trim() ||
      studio.lyrics.trim() ||
      studio.lyricsContext.trim() ||
      studio.title.trim()
    );

    if (hasExistingStudioData) {
      setPendingStudioPayload({ lyrics: nextLyrics, style: nextStyle });
      setConfirmAction("replaceStudio");
      return;
    }

    studio.reset();
    studio.setLyrics(nextLyrics);
    studio.setSongIdea(nextStyle);
    router.push("/");
  }

  async function generateStyleSuggestion() {
    if (!topic.trim() || !mood.trim() || !combinedLyrics.trim()) return;

    setGeneratingStyleSuggestion(true);
    try {
      const response = await fetch("/api/lyric-studio/style-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          mood,
          lyrics: combinedLyrics,
          language: effectiveLanguage,
          styleHint: style,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setNotice({ type: "error", message: data?.error || "Style suggestion genereren is mislukt." });
        return;
      }
      const data = await response.json();
      if (data?.suggestion && typeof data.suggestion === "string") {
        setStyleSuggestion(data.suggestion);
      }
    } catch {
      setNotice({ type: "error", message: "Style suggestion genereren is mislukt." });
    } finally {
      setGeneratingStyleSuggestion(false);
    }
  }

  async function copyStyleSuggestion() {
    if (!styleSuggestion.trim()) return;
    try {
      await navigator.clipboard.writeText(styleSuggestion);
      setCopiedStyleSuggestion(true);
      window.setTimeout(() => setCopiedStyleSuggestion(false), 2000);
    } catch {
      setNotice({ type: "error", message: "Style kopieren mislukt." });
    }
  }

  function clearAllDraft(force = false) {
    if (!force) {
      setConfirmAction("clearAll");
      return;
    }

    setTopic("");
    setMood("");
    setStyle("");
    setBlocks([]);
    setActivePreset("");
    setLyricCols(2);
    setShowLyricsSidebar(false);
    setShowStructureDropdown(false);
    setStructure("");
    setCustomStructure("");
    setRepetitiveChorus(true);
    setCreativityLevel(5);
    setContextLevel(5);
    setLanguage("English");
    setCustomLanguage("");
    setStyleSuggestion("");
    setCopiedStyleSuggestion(false);
    setShowLoadSnapshots(false);
    window.localStorage.removeItem(LYRICS_STUDIO_STORAGE_KEY);
    setNotice({ type: "info", message: "Lyric Studio is leeggemaakt." });
  }

  function handleConfirmAction() {
    if (confirmAction === "replaceBlocks") {
      if (pendingPresetName) {
        setActivePreset(pendingPresetName);
        setBlocks(createPresetBlocks(BLOCK_PRESETS[pendingPresetName], pendingPresetName));
      }
      setPendingPresetName(null);
      setConfirmAction(null);
      return;
    }

    if (confirmAction === "replaceStudio") {
      if (pendingStudioPayload) {
        const studio = useStudioStore.getState();
        studio.reset();
        studio.setLyrics(pendingStudioPayload.lyrics);
        studio.setSongIdea(pendingStudioPayload.style);
        router.push("/");
      }
      setPendingStudioPayload(null);
      setConfirmAction(null);
      return;
    }

    if (confirmAction === "clearAll") {
      clearAllDraft(true);
      setConfirmAction(null);
      return;
    }

    setConfirmAction(null);
  }

  return (
    <div className="flex h-[calc(100vh-var(--player-height))] bg-[#0d0d12] text-white overflow-hidden">
      <Sidebar credits={credits} />

      {/* Collapsible lyrics sidebar */}
      <CollapsibleSidebar open={showLyricsSidebar} onClose={() => setShowLyricsSidebar(false)}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold">Volledige lyrics</h2>
          <button
            type="button"
            onClick={copyAllLyrics}
            disabled={!combinedLyrics}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/75 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="whitespace-pre-wrap text-white/90 text-base font-mono">{combinedLyrics || "(nog geen lyrics)"}</pre>
      </CollapsibleSidebar>

      <main className="flex-1 flex flex-col lg:ml-[240px] overflow-hidden pt-[65px] lg:pt-0">
        <div className="flex-1 overflow-y-auto">
          <div className="w-full px-4 py-6 lg:px-6 lg:py-8">
            <LyricsNotice notice={notice} onClose={() => setNotice(null)} />

            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold mb-2">Lyric Studio</h1>
                <p className="text-white/60">Build songs section by section, then send the finished lyrics to Studio.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openSaveSnapshotModal}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
                  title="Save lyrics snapshot"
                >
                  Save lyrics
                </button>
                <button
                  type="button"
                  onClick={() => setShowLoadSnapshots(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Load lyrics snapshot"
                  disabled={savedSnapshots.length === 0}
                >
                  Load lyrics
                </button>
                <button
                  type="button"
                  onClick={() => clearAllDraft()}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
                  title="Clear all lyric studio data"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => setShowLyricsSidebar((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
                  title="Toon/verberg volledige lyrics"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
                  </svg>
                  Lyrics
                </button>
              </div>
            </div>

            <LyricsSnapshotModals
              showLoadSnapshots={showLoadSnapshots}
              showSaveSnapshotModal={showSaveSnapshotModal}
              savedSnapshots={savedSnapshots}
              snapshotNameInput={snapshotNameInput}
              onCloseLoad={() => setShowLoadSnapshots(false)}
              onCloseSave={() => setShowSaveSnapshotModal(false)}
              onSnapshotNameChange={setSnapshotNameInput}
              onLoadSnapshot={loadLyricsSnapshot}
              onDeleteSnapshot={deleteLyricsSnapshot}
              onSaveSnapshot={() => saveLyricsSnapshot(snapshotNameInput)}
            />

            <LyricsConfirmModal
              confirmAction={confirmAction}
              onConfirm={handleConfirmAction}
              onCancel={() => {
                setConfirmAction(null);
                setPendingPresetName(null);
                setPendingStudioPayload(null);
              }}
            />

            <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)_340px]">
              <LyricsControlPanel
                topic={topic}
                mood={mood}
                style={style}
                selectedLanguage={selectedLanguage}
                isCustomLanguage={isCustomLanguage}
                customLanguage={customLanguage}
                structure={structure}
                customStructure={customStructure}
                showStructureDropdown={showStructureDropdown}
                activePreset={activePreset}
                repetitiveChorus={repetitiveChorus}
                creativityLevel={creativityLevel}
                creativityZone={creativityZone}
                temperature={temperature}
                contextLevel={contextLevel}
                contextZone={contextZone}
                topP={topP}
                canGenerateBlocks={canGenerateBlocks}
                generatingSong={generatingSong}
                blockTypes={BLOCK_TYPES}
                blockLabels={BLOCK_LABELS}
                blockColors={BLOCK_COLORS}
                presets={BLOCK_PRESETS}
                combinedLyrics={combinedLyrics}
                copied={copied}
                onTopicChange={setTopic}
                onMoodChange={setMood}
                onStyleChange={setStyle}
                onLanguageChange={setLanguage}
                onCustomLanguageChange={setCustomLanguage}
                onStructureChange={setStructure}
                onCustomStructureChange={setCustomStructure}
                onToggleStructureDropdown={() => setShowStructureDropdown((previous) => !previous)}
                onStructureDropdownClose={() => setShowStructureDropdown(false)}
                onPresetApply={applyPreset}
                onActivePresetClear={() => {
                  setStructure("");
                  setCustomStructure("");
                  setActivePreset("");
                }}
                onRepetitiveChorusChange={setRepetitiveChorus}
                onCreativityLevelChange={setCreativityLevel}
                onContextLevelChange={setContextLevel}
                onGenerateSong={generateSongLyrics}
                onStopGenerating={stopSongGeneration}
                onAddBlock={addBlock}
                onClearAll={() => clearAllDraft()}
                onCopyAll={copyAllLyrics}
              />

              <section className="min-h-[620px] rounded-2xl border border-white/10 bg-[#101018]/80 p-4 lg:p-5">
                {showTranslationView ? (
                  <TranslationReview
                    blocks={blocks}
                    translatedBlocks={translatedBlocks}
                    effectiveTranslationLanguage={effectiveTranslationLanguage}
                    onUseTranslation={(blockId, translated) => {
                      setBlocks((current) =>
                        current.map((b) => (b.id === blockId ? { ...b, content: translated } : b))
                      );
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
                      setBlocks((current) =>
                        current.map((b) =>
                          b.id === blockId ? { ...b, content: `${original}\n\n---\n\n${translated}` } : b
                        )
                      );
                      const next = new Map(translatedBlocks);
                      next.delete(blockId);
                      setTranslatedBlocks(next);
                    }}
                    onDone={() => setShowTranslationView(false)}
                  />
                ) : (
                  <>
                    <LyricBlockEditor
                      blocks={blocks}
                      lyricCols={lyricCols}
                      setLyricCols={setLyricCols}
                      blockColors={BLOCK_COLORS}
                      blockLabels={BLOCK_LABELS}
                      draggedBlockId={draggedBlockId}
                      dropTarget={dropTarget}
                      canGenerateBlocks={canGenerateBlocks}
                      translatingBlockId={translatingBlockId}
                      effectiveTranslationLanguage={effectiveTranslationLanguage}
                      onStartBlockDrag={startBlockDrag}
                      onStartBlockDragFromCard={startBlockDragFromCard}
                      onMoveBlock={moveBlock}
                      onDuplicateBlock={duplicateBlock}
                      onDeleteBlock={deleteBlock}
                      onUpdateBlock={updateBlock}
                      onGenerateBlock={generateBlock}
                      onTranslateBlock={translateBlock}
                      autoGrowTextarea={autoGrowTextarea}
                    />
                  </>
                )}

                <LyricsBottomActions
                  blocks={blocks}
                  translationLanguage={translationLanguage}
                  customTranslationLanguage={customTranslationLanguage}
                  translatingLyrics={translatingLyrics}
                  combinedLyrics={combinedLyrics}
                  copied={copied}
                  onTranslationLanguageChange={setTranslationLanguage}
                  onCustomTranslationLanguageChange={setCustomTranslationLanguage}
                  onTranslateAllLyrics={translateAllLyrics}
                  onCopyAllLyrics={copyAllLyrics}
                  onUseInStudio={useInStudio}
                />
              </section>

              <LyricsStudioSidePanel
                blocks={blocks}
                topic={topic}
                mood={mood}
                style={style}
                combinedLyrics={combinedLyrics}
                styleSuggestion={styleSuggestion}
                generatingStyleSuggestion={generatingStyleSuggestion}
                copiedStyleSuggestion={copiedStyleSuggestion}
                onGenerateStyleSuggestion={generateStyleSuggestion}
                onStyleSuggestionChange={setStyleSuggestion}
                onCopyStyleSuggestion={copyStyleSuggestion}
                onUseLyricsAndStyleInStudio={useLyricsAndStyleInStudio}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
