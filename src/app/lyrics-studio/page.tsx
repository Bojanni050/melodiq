"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Flowchart from "@/components/Flowchart";
import CollapsibleSidebar from "@/components/CollapsibleSidebar";
import { useStudioStore } from "@/lib/store";

type BlockType = "intro" | "verse" | "pre-chorus" | "chorus" | "post-chorus" | "bridge" | "outro";

interface LyricBlock {
  id: string;
  type: BlockType;
  label: string;
  content: string;
  generating: boolean;
  uniqueChorusOverride: boolean;
}

interface LyricStudioSnapshot {
  id: string;
  name: string;
  createdAt: string;
  payload: {
    topic: string;
    mood: string;
    style: string;
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

type LyricsStudioNotice = {
  type: "error" | "success" | "info";
  message: string;
};

type ConfirmAction = "replaceBlocks" | "replaceStudio" | "clearAll" | null;

const LYRICS_STUDIO_STORAGE_KEY = "sonara-lyrics-studio";
const LYRICS_STUDIO_SNAPSHOTS_KEY = "sonara-lyrics-studio-snapshots";

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "Frisian",
  "German",
  "Polish",
  "Serbian",
  "Japanese",
  "Korean",
  "Hindi",
  "Portuguese",
  "Italian",
  "Mandarin",
  "Dutch",
  "Other...",
];

const TRANSLATION_LANGUAGES = [
  { value: "nl", label: "Nederlands (nl)" },
  { value: "en", label: "English (en)" },
  { value: "fr", label: "French (fr)" },
  { value: "de", label: "German (de)" },
  { value: "es", label: "Spanish (es)" },
  { value: "it", label: "Italian (it)" },
  { value: "pt", label: "Portuguese (pt)" },
  { value: "pl", label: "Polish (pl)" },
  { value: "sr", label: "Serbian (sr)" },
  { value: "ja", label: "Japanese (ja)" },
  { value: "ko", label: "Korean (ko)" },
  { value: "hi", label: "Hindi (hi)" },
  { value: "zh", label: "Mandarin (zh)" },
  { value: "other", label: "Other..." },
];

const STRUCTURES = [
  { label: "Eenvoudige pop-variaties", group: true },
  { value: "abab", label: "ABAB", desc: "Vers - Refrein - Vers - Refrein. Simpel, radio-vriendelijk." },
  { value: "ababc", label: "ABABC", desc: "Vers - Refrein - Vers - Refrein - Brug/Outro. Extra ruimte voor finale." },
  { value: "ababcbc", label: "ABABCBC", desc: "Extra herhaling van B/C voor dramatische build-up. Festival-stijl." },
  { value: "aaa", label: "AAA (alleen couplet)", desc: "Alles is tekst-vers, muziek herhaalt zich. Volksliedjes, ballads." },
  { value: "aaba", label: "AABA (klassieke 32-bar)", desc: "A-vers - A-vers - B-brug - A-vers. Jazz, ballads, cine-muziek." },
  { label: "Dance / TCH-stijl", group: true },
  { value: "dance-2drops", label: "Intro -> Verse -> Build -> Drop -> Verse -> Build -> Drop -> Outro", desc: "Klassieke 2-drops-structuur. House/techno." },
  { value: "dance-breaks", label: "Intro -> Break -> Build -> Drop -> Break -> Build -> Drop -> Outro", desc: "Twee break-build-drop-blokken. Ideaal voor clubs." },
  { value: "dance-earlydrop", label: "Intro -> Verse -> Drop -> Verse -> Break -> Build -> Drop -> Outro", desc: "Direct in de drop. Festival/peak-hour." },
  { value: "one-drop", label: "One-drop / minimal", desc: "Intro -> Break -> Build -> Drop -> Outro. Focus op textuur." },
  { label: "Singer-songwriter pop", group: true },
  { value: "pop-classic", label: "Intro -> Verse -> Chorus -> Verse -> Chorus -> Bridge -> Chorus -> Outro", desc: "Klassieke pop-structuur (ABABCB). Radio-ready." },
  { value: "pop-default", label: "Intro -> Verse -> Pre-Chorus -> Chorus -> Verse -> Pre-Chorus -> Chorus -> Bridge -> Chorus", desc: "Standaard pop-structuur met pre-chorus builds." },
  { value: "pop-finallift", label: "Intro -> Verse -> Chorus -> Bridge -> Chorus -> Final lift", desc: "Extra brug + lift (strip-down + build-up)." },
  { value: "pop-prechorus", label: "Intro -> Verse -> Chorus -> Pre-Chorus -> Chorus -> Bridge -> Outro", desc: "Pre-chorus voegt spanning toe. Dramatische pop." },
  { value: "pop-triplechorus", label: "Intro -> Verse -> Chorus -> Verse -> Chorus -> Chorus -> Outro", desc: "Drie keer refrein voor sticky effect." },
  { value: "pop-instrumental", label: "Intro -> Verse -> Chorus -> Bridge -> Instrumental -> Chorus -> Outro", desc: "Instrumentale highlight na de brug. Solo/pads." },
  { value: "ai-choose", label: "Kies jij maar", desc: "AI kiest de beste structuur." },
  { value: "manual", label: "Handmatig", desc: "Typ je eigen structuur." },
];

const BLOCK_TYPES: BlockType[] = [
  "intro",
  "verse",
  "pre-chorus",
  "chorus",
  "post-chorus",
  "bridge",
  "outro",
];

const BLOCK_PRESETS: Record<string, BlockType[]> = {
  "Pop": ["intro", "verse", "pre-chorus", "chorus", "verse", "pre-chorus", "chorus", "bridge", "chorus"],
  "ABABCB": ["verse", "chorus", "verse", "chorus", "bridge", "chorus"],
  "AABA": ["verse", "verse", "bridge", "verse"],
  "Extended": ["intro", "verse", "chorus", "verse", "chorus", "bridge", "chorus", "chorus", "outro"],
  "EDM — 2 Drops": ["intro", "verse", "pre-chorus", "chorus", "verse", "pre-chorus", "chorus", "outro"],
  "EDM — Build & Drop": ["intro", "verse", "chorus", "bridge", "chorus", "outro"],
  "Dance — Early Drop": ["intro", "chorus", "verse", "pre-chorus", "chorus", "bridge", "chorus", "outro"],
  "Minimal / One Drop": ["intro", "verse", "chorus", "outro"],
};

const BLOCK_COLORS: Record<BlockType, string> = {
  intro: "rgba(255,255,255,0.15)",
  verse: "#3b82f6",
  "pre-chorus": "#eab308",
  chorus: "#ff530c",
  "post-chorus": "#22c55e",
  bridge: "#a855f7",
  outro: "rgba(255,255,255,0.15)",
};

const BLOCK_LABELS: Record<BlockType, string> = {
  intro: "Intro",
  verse: "Verse",
  "pre-chorus": "Pre-Chorus",
  chorus: "Chorus",
  "post-chorus": "Post-Chorus",
  bridge: "Bridge",
  outro: "Outro",
};

const STRUCTURE_PRESET_MAP: Record<string, string> = {
  abab: "ABABCB",
  ababc: "ABABCB",
  ababcbc: "Extended",
  aaa: "AABA",
  aaba: "AABA",
  "dance-2drops": "EDM — 2 Drops",
  "dance-breaks": "EDM — Build & Drop",
  "dance-earlydrop": "Dance — Early Drop",
  "one-drop": "Minimal / One Drop",
  "pop-classic": "Pop",
  "pop-default": "Pop",
  "pop-finallift": "Extended",
  "pop-prechorus": "Pop",
  "pop-triplechorus": "Extended",
  "pop-instrumental": "Extended",
};

function isDancePreset(presetName?: string) {
  return Boolean(
    presetName?.startsWith("EDM") ||
      presetName?.startsWith("Dance") ||
      presetName?.startsWith("Minimal")
  );
}

function getPresetBlockLabel(type: BlockType, presetName?: string) {
  if (!isDancePreset(presetName)) return BLOCK_LABELS[type];
  if (type === "chorus") return "Drop";
  if (type === "bridge") return "Breakdown";
  if (type === "pre-chorus") return "Build-up";
  return BLOCK_LABELS[type];
}

function parseStructureText(text: string): BlockType[] {
  const normalized = text.toLowerCase();
  const matches = normalized.match(/pre[-\s]?chorus|post[-\s]?chorus|build[-\s]?up|breakdown|intro|verse|chorus|bridge|outro|drop|build|break/g);
  if (!matches) return [];

  return matches.map((match) => {
    if (match.includes("pre") || match.includes("build")) return "pre-chorus";
    if (match.includes("post")) return "post-chorus";
    if (match.includes("drop") || match.includes("chorus")) return "chorus";
    if (match.includes("break") || match.includes("bridge")) return "bridge";
    if (match.includes("intro")) return "intro";
    if (match.includes("outro")) return "outro";
    return "verse";
  });
}

function createBlock(type: BlockType, label?: string): LyricBlock {
  return {
    id: crypto.randomUUID(),
    type,
    label: label || BLOCK_LABELS[type],
    content: "",
    generating: false,
    uniqueChorusOverride: false,
  };
}

function createPresetBlocks(types: BlockType[], presetName?: string): LyricBlock[] {
  const totalByLabel = types.reduce<Record<string, number>>((counts, type) => {
    const label = getPresetBlockLabel(type, presetName);
    counts[label] = (counts[label] || 0) + 1;
    return counts;
  }, {});

  const seenByLabel: Record<string, number> = {};

  return types.map((type) => {
    const baseLabel = getPresetBlockLabel(type, presetName);
    seenByLabel[baseLabel] = (seenByLabel[baseLabel] || 0) + 1;
    const label = totalByLabel[baseLabel] > 1 ? `${baseLabel} ${seenByLabel[baseLabel]}` : baseLabel;
    return createBlock(type, label);
  });
}

function combineLyrics(blocks: LyricBlock[]) {
  return blocks
    .filter((block) => block.content.trim())
    .map((block) => `[${block.label.trim() || BLOCK_LABELS[block.type]}]\n${block.content.trim()}`)
    .join("\n\n");
}

function autoGrowTextarea(element: HTMLTextAreaElement) {
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

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
    try {
      const raw = window.localStorage.getItem(LYRICS_STUDIO_SNAPSHOTS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const validSnapshots = parsed.filter((item) => {
        return (
          item &&
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          typeof item.createdAt === "string" &&
          item.payload &&
          typeof item.payload === "object"
        );
      }) as LyricStudioSnapshot[];
      setSavedSnapshots(validSnapshots);
    } catch {}
  }, []);

  useEffect(() => {
    if (!hasRestoredDraft) return;

    const payload = {
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
    };

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

  function buildDraftPayload() {
    return {
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
    };
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
      payload: buildDraftPayload(),
    };

    const next = [snapshot, ...savedSnapshots].slice(0, 30);
    setSavedSnapshots(next);
    window.localStorage.setItem(LYRICS_STUDIO_SNAPSHOTS_KEY, JSON.stringify(next));
    setShowSaveSnapshotModal(false);
    setNotice({ type: "success", message: "Lyrics snapshot opgeslagen." });
  }

  function sanitizeBlocksForLoad(input: LyricBlock[]): LyricBlock[] {
    const validTypes = new Set<BlockType>(BLOCK_TYPES);
    return (input || [])
      .filter((block) => !!block && validTypes.has(block.type))
      .map((block, index) => ({
        id: typeof block.id === "string" && block.id.trim() ? block.id : `loaded-${index}-${crypto.randomUUID()}`,
        type: block.type,
        label: typeof block.label === "string" && block.label.trim() ? block.label : BLOCK_LABELS[block.type],
        content: typeof block.content === "string" ? block.content : "",
        generating: false,
        uniqueChorusOverride:
          block.type === "chorus" && typeof block.uniqueChorusOverride === "boolean"
            ? block.uniqueChorusOverride
            : false,
      }));
  }

  function loadLyricsSnapshot(snapshot: LyricStudioSnapshot) {
    const payload = snapshot.payload;
    setTopic(payload.topic || "");
    setMood(payload.mood || "");
    setStyle(payload.style || "");
    setBlocks(sanitizeBlocksForLoad(payload.blocks || []));
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
            {notice && (
              <div className="fixed right-4 top-4 z-[90] w-[min(420px,calc(100vw-2rem))] rounded-2xl border border-red-500/30 bg-[#201215] px-4 py-3 shadow-2xl">
                <div className="flex items-start gap-3">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-red-100">{notice.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotice(null)}
                    className="text-red-200/70 hover:text-red-100"
                    aria-label="Sluit melding"
                    title="Sluiten"
                  >
                    x
                  </button>
                </div>
              </div>
            )}

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

            {showLoadSnapshots && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm" onClick={() => setShowLoadSnapshots(false)}>
                <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#11111a] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white/80">Load saved lyrics</h3>
                    <button
                      type="button"
                      onClick={() => setShowLoadSnapshots(false)}
                      className="text-white/40 hover:text-white/70"
                      title="Close"
                    >
                      x
                    </button>
                  </div>
                  {savedSnapshots.length === 0 ? (
                    <p className="text-xs text-white/45">No saved snapshots yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                      {savedSnapshots.map((snapshot) => (
                        <div key={snapshot.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => loadLyricsSnapshot(snapshot)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-sm text-white/85">{snapshot.name}</p>
                            <p className="text-xs text-white/45">{new Date(snapshot.createdAt).toLocaleString()}</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteLyricsSnapshot(snapshot.id)}
                            className="px-2 py-1 text-xs text-red-300/80 hover:text-red-200"
                            title="Delete snapshot"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {showSaveSnapshotModal && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm" onClick={() => setShowSaveSnapshotModal(false)}>
                <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#11111a] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white/80">Save lyrics snapshot</h3>
                    <button
                      type="button"
                      onClick={() => setShowSaveSnapshotModal(false)}
                      className="text-white/40 hover:text-white/70"
                      title="Close"
                    >
                      x
                    </button>
                  </div>
                  <input
                    type="text"
                    value={snapshotNameInput}
                    onChange={(event) => setSnapshotNameInput(event.target.value)}
                    className="input-field text-sm"
                    placeholder="Snapshot naam"
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => saveLyricsSnapshot(snapshotNameInput)}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSaveSnapshotModal(false)}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-xs font-medium text-white/50 transition hover:bg-white/5 hover:text-white/80"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {confirmAction && (
              <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm" onClick={() => {
                setConfirmAction(null);
                setPendingPresetName(null);
                setPendingStudioPayload(null);
              }}>
                <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-[#2b1f10] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-start gap-3">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-amber-100">
                        {confirmAction === "replaceBlocks" && "Huidige blocks vervangen door de gekozen preset?"}
                        {confirmAction === "replaceStudio" && "Studio bevat al data. Wil je die vervangen met deze lyrics en style?"}
                        {confirmAction === "clearAll" && "Weet je zeker dat je alle Lyric Studio data wilt wissen?"}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleConfirmAction}
                          className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-100 transition hover:bg-amber-500/25"
                        >
                          Bevestigen
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmAction(null);
                            setPendingPresetName(null);
                            setPendingStudioPayload(null);
                          }}
                          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-xs font-medium text-white/60 transition hover:bg-white/5 hover:text-white/80"
                        >
                          Annuleren
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)_340px]">
              <aside className="space-y-4 lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:pr-1">
                <section className="section-card">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-white/80">Song Metadata</h3>
                    <p className="mt-1 text-xs text-white/35">Used as context for each generated block.</p>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={topic}
                      onChange={(event) => setTopic(event.target.value)}
                      placeholder="Where is the song about?"
                      className="input-field text-sm"
                    />
                    <input
                      type="text"
                      value={mood}
                      onChange={(event) => setMood(event.target.value)}
                      placeholder="Vibe / mood / atmosphere"
                      className="input-field text-sm"
                    />
                    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-white/8 to-white/4 p-px">
                      <select
                        value={selectedLanguage}
                        onChange={(event) => setLanguage(event.target.value)}
                        aria-label="Language"
                        className="select-field w-full appearance-none border-0 bg-[#12121a] text-sm pr-10 shadow-none"
                      >
                        {LANGUAGES.map((lang) => (
                          <option key={lang} value={lang} className="bg-gray-900">
                            {lang}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40">
                        v
                      </span>
                    </div>

                    {isCustomLanguage && (
                      <input
                        type="text"
                        value={customLanguage}
                        onChange={(event) => setCustomLanguage(event.target.value)}
                        placeholder="Custom language"
                        className="input-field text-sm"
                      />
                    )}

                    <input
                      type="text"
                      value={style}
                      onChange={(event) => setStyle(event.target.value)}
                      placeholder="Genre / style hints (optional)"
                      className="input-field text-sm"
                    />
                  </div>
                </section>

                <section className="section-card">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white/80">Song Structure</h3>
                    {structure && (
                      <button
                        type="button"
                        onClick={() => {
                          setStructure("");
                          setCustomStructure("");
                          setActivePreset("");
                        }}
                        className="text-white/30 hover:text-white/60 transition-colors"
                        title="Clear"
                      >
                        x
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowStructureDropdown(!showStructureDropdown)}
                      className="w-full input-field text-left text-sm flex items-center justify-between"
                    >
                      <span className={structure ? "text-white" : "text-white/40"}>
                        {structure === "ai-choose"
                          ? "Kies jij maar"
                          : structure === "manual"
                            ? "Handmatig"
                            : structure
                              ? STRUCTURES.find((item) => item.value === structure)?.label || "Select..."
                              : "Select song structure..."}
                      </span>
                      <span className={showStructureDropdown ? "rotate-180 transition-transform" : "transition-transform"}>
                        v
                      </span>
                    </button>

                    {showStructureDropdown && (
                      <div className="absolute z-50 mt-1 w-full bg-[#1a1a24] border border-white/10 rounded-lg shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                        {STRUCTURES.map((item, index) => {
                          if (item.group) {
                            return (
                              <div key={`${item.label}-${index}`} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30 bg-white/5">
                                {item.label}
                              </div>
                            );
                          }

                          return (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => {
                                setStructure(item.value || "");
                                setActivePreset(STRUCTURE_PRESET_MAP[item.value || ""] || "");
                                setShowStructureDropdown(false);
                              }}
                              className={`w-full text-left px-3 py-2.5 transition-colors ${
                                structure === item.value
                                  ? "bg-primary-500/10 text-white"
                                  : "text-white/60 hover:bg-white/5"
                              }`}
                            >
                              <p className="text-sm">{item.label}</p>
                              <p className="text-xs text-white/30 mt-0.5">{item.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {structure === "manual" && (
                    <textarea
                      value={customStructure}
                      onChange={(event) => setCustomStructure(event.target.value)}
                      placeholder="Describe your custom song structure..."
                      className="input-field min-h-[80px] resize-y text-sm mt-3"
                    />
                  )}

                  {structure && structure !== "ai-choose" && structure !== "manual" && (
                    <p className="text-xs text-white/30 mt-2">
                      {STRUCTURES.find((item) => item.value === structure)?.desc}
                    </p>
                  )}

                  <div className="mt-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-white/30">
                      Presets
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.keys(BLOCK_PRESETS).map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => applyPreset(name)}
                          className={`rounded-lg border px-3 py-2 text-sm transition hover:border-primary-500/50 hover:bg-primary-500/10 hover:text-white ${
                            activePreset === name
                              ? "border-primary-500/50 bg-primary-500/10 text-white"
                              : "border-white/10 bg-white/5 text-white/70"
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="mt-4 flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={repetitiveChorus}
                      onChange={(event) => setRepetitiveChorus(event.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Repetitive chorus
                      <span className="block text-xs text-white/45">
                        {repetitiveChorus
                          ? "AI writes one chorus and repeats it throughout the song."
                          : "AI writes chorus variations throughout the song."}
                      </span>
                    </span>
                  </label>

                  <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-3">
                    <div className="flex items-center justify-between text-sm text-white/85">
                      <span>Creativity</span>
                      <span>{creativityLevel}/10</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={creativityLevel}
                      onChange={(event) => setCreativityLevel(Number(event.target.value))}
                      className="mt-2 w-full accent-primary-500"
                    />
                    <p className="mt-1 text-xs text-white/50">
                      {creativityZone} • temp {temperature.toFixed(2)} • zones: 1-3 laag, 4-7 middel, 8-10 hoog
                    </p>
                  </div>

                  <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-3">
                    <div className="flex items-center justify-between text-sm text-white/85">
                      <span>Context (Top-P)</span>
                      <span>{contextLevel}/10</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={contextLevel}
                      onChange={(event) => setContextLevel(Number(event.target.value))}
                      className="mt-2 w-full accent-primary-500"
                    />
                    <p className="mt-1 text-xs text-white/50">
                      {contextZone} • top-p {topP.toFixed(2)} • intern 0.1-1.0
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={generateSongLyrics}
                    disabled={!canGenerateBlocks || generatingSong}
                    title={canGenerateBlocks ? "Generate complete song lyrics" : "Add topic and mood first"}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {generatingSong ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      "Generate complete song"
                    )}
                  </button>

                  {generatingSong && (
                    <button
                      type="button"
                      onClick={stopSongGeneration}
                      className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
                    >
                      Stop generating
                    </button>
                  )}
                </section>

                <section className="section-card">
                  <h3 className="mb-3 text-sm font-semibold text-white/80">Add Block</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {BLOCK_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => addBlock(type)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/70 transition hover:border-primary-500/50 hover:bg-primary-500/10 hover:text-white"
                      >
                        <span
                          className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: BLOCK_COLORS[type] }}
                        />
                        {BLOCK_LABELS[type]}
                      </button>
                    ))}
                  </div>
                </section>
              </aside>

              <section className="min-h-[620px] rounded-2xl border border-white/10 bg-[#101018]/80 p-4 lg:p-5">
                {/* Kolom-toggles */}
                <div className="flex justify-end mb-2">
                  <label className="flex items-center gap-2 text-xs text-white/50 select-none">
                    <input
                      type="radio"
                      name="lyric-cols"
                      checked={lyricCols === 1}
                      onChange={() => setLyricCols(1)}
                    />
                    1 kolom
                  </label>
                  <label className="flex items-center gap-2 ml-4 text-xs text-white/50 select-none">
                    <input
                      type="radio"
                      name="lyric-cols"
                      checked={lyricCols === 2}
                      onChange={() => setLyricCols(2)}
                    />
                    2 kolommen
                  </label>
                </div>
                {blocks.length === 0 ? (
                  <div className="flex min-h-[460px] items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-center">
                    <p className="text-sm text-white/40">Add your first block to get started</p>
                  </div>
                ) : showTranslationView ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white/80">Translation Review</h3>
                      <button
                        type="button"
                        onClick={() => setShowTranslationView(false)}
                        className="text-xs text-white/40 hover:text-white/70 transition-colors"
                      >
                        ← Back to editor
                      </button>
                    </div>
                    {blocks.map((block) => {
                      const translated = translatedBlocks.get(block.id);
                      if (!block.content.trim() || !translated?.trim()) return null;
                      return (
                        <div key={block.id} className="rounded-xl border border-white/10 bg-[#15151f] p-4">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-3">{block.label}</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[11px] font-semibold text-white/40 mb-2">Original</p>
                              <p className="text-sm leading-6 text-white/90 whitespace-pre-wrap">{block.content}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold text-white/40 mb-2">{effectiveTranslationLanguage}</p>
                              <p className="text-sm leading-6 text-white/90 whitespace-pre-wrap">{translated}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setBlocks((current) =>
                                  current.map((b) =>
                                    b.id === block.id ? { ...b, content: translated } : b
                                  )
                                );
                                const next = new Map(translatedBlocks);
                                next.delete(block.id);
                                setTranslatedBlocks(next);
                              }}
                              className="text-xs rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-green-200 hover:bg-green-500/20 transition-colors"
                            >
                              ✓ Accept translation
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const next = new Map(translatedBlocks);
                                next.delete(block.id);
                                setTranslatedBlocks(next);
                              }}
                              className="text-xs rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white/60 hover:bg-white/10 transition-colors"
                            >
                              Skip
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setShowTranslationView(false)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60 hover:bg-white/10 transition-colors"
                    >
                      Done reviewing translations
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      className={`grid gap-4 ${lyricCols === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}
                    >
                      {blocks.map((block, index) => (
                        (() => {
                          const isDragged = draggedBlockId === block.id;
                          const showDropBefore = dropTarget?.id === block.id && dropTarget.position === "before";
                          const showDropAfter = dropTarget?.id === block.id && dropTarget.position === "after";

                          return (
                        <article
                          key={block.id}
                          data-lyric-block-id={block.id}
                          aria-grabbed={isDragged}
                          onPointerDown={(event) => startBlockDragFromCard(event, block.id)}
                          className={`relative rounded-xl border border-white/10 bg-[#15151f] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.18)] flex flex-col transition touch-none cursor-grab active:cursor-grabbing select-none ${isDragged ? "opacity-55 scale-[0.985]" : ""}`}
                          style={{ borderLeft: `4px solid ${BLOCK_COLORS[block.type]}` }}
                          title="Drag to reorder"
                        >
                        {showDropBefore && <div className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary-400" />}
                        <div className="mb-3 flex flex-wrap items-center gap-2 select-none">
                          <button
                            type="button"
                            onPointerDown={(event) => startBlockDrag(event, block.id)}
                            aria-grabbed={isDragged}
                            className="h-11 w-11 shrink-0 rounded-lg border border-white/10 text-white/45 transition hover:bg-white/10 hover:text-white cursor-grab active:cursor-grabbing touch-none"
                            title="Drag to reorder"
                            aria-label={`Drag ${block.label || BLOCK_LABELS[block.type]} block`}
                          >
                            <svg className="mx-auto h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 6h.01M10 12h.01M10 18h.01M14 6h.01M14 12h.01M14 18h.01" />
                            </svg>
                          </button>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-white/25">
                            Drag to reorder
                          </div>
                          <span
                            className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white"
                            style={{ backgroundColor: BLOCK_COLORS[block.type] }}
                          >
                            {BLOCK_LABELS[block.type]}
                          </span>
                          <input
                            type="text"
                            value={block.label}
                            onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-primary-500/60"
                            aria-label={`${BLOCK_LABELS[block.type]} label`}
                          />
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveBlock(block.id, -1)}
                              disabled={index === 0}
                              className="h-9 w-9 rounded-lg border border-white/10 text-white/45 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                              title="Move up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveBlock(block.id, 1)}
                              disabled={index === blocks.length - 1}
                              className="h-9 w-9 rounded-lg border border-white/10 text-white/45 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                              title="Move down"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => duplicateBlock(block.id)}
                              className="h-9 w-9 rounded-lg border border-white/10 text-white/45 transition hover:bg-white/10 hover:text-white"
                              title="Duplicate block"
                            >
                              <svg className="mx-auto h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteBlock(block.id)}
                              className="h-9 w-9 rounded-lg border border-white/10 text-white/45 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-200"
                              title="Delete block"
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        {block.type === "chorus" && (
                          <label className="mb-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75">
                            <input
                              type="checkbox"
                              checked={block.uniqueChorusOverride}
                              onChange={(event) =>
                                updateBlock(block.id, { uniqueChorusOverride: event.target.checked })
                              }
                            />
                            Unique chorus override
                          </label>
                        )}

                        <textarea
                          value={block.content}
                          disabled={block.generating}
                          onInput={(event) => autoGrowTextarea(event.currentTarget)}
                          onChange={(event) => updateBlock(block.id, { content: event.target.value })}
                          placeholder="Lyrics will appear here..."
                          rows={4}
                          className="min-h-[112px] w-full resize-y rounded-xl border border-white/10 bg-[#0f0f16] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-primary-500/60 disabled:cursor-wait disabled:opacity-60"
                          style={{overflow: 'auto'}}
                        />

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => generateBlock(block)}
                            disabled={block.generating || !canGenerateBlocks}
                            title={canGenerateBlocks ? "Generate block" : "Add topic and mood first"}
                            className="inline-flex min-w-[118px] items-center justify-center rounded-lg bg-primary-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-400 disabled:cursor-not-allowed disabled:bg-primary-500/50"
                          >
                            {block.generating ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                              "✨ Generate"
                            )}
                          </button>
                          <span className="text-xs text-white/35">{block.content.length} chars</span>
                        </div>
                        {showDropAfter && <div className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary-400" />}
                      </article>
                          );
                        })()
                      ))}

                    </div>
                    {/* Alleen tonen op 1 kolom (mobile/tablet), onderaan blocks */}
                    <div className="block xl:hidden">
                      <Flowchart blocks={blocks.map(b => ({ label: b.label, type: b.type }))} />
                    </div>
                  </>
                )}

                <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
                  <div className="flex flex-1 flex-col gap-2 sm:max-w-[280px]">
                    <select
                      value={translationLanguage}
                      onChange={(event) => setTranslationLanguage(event.target.value)}
                      aria-label="Doeltaal voor vertaling"
                      className="select-field w-full text-sm"
                    >
                      {TRANSLATION_LANGUAGES.map((item) => (
                        <option key={item.value} value={item.value} className="bg-gray-900">
                          {item.label}
                        </option>
                      ))}
                    </select>
                    {translationLanguage === "other" && (
                      <input
                        type="text"
                        value={customTranslationLanguage}
                        onChange={(event) => setCustomTranslationLanguage(event.target.value)}
                        placeholder="Doeltaal, bv. Swedish"
                        className="input-field text-sm"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={translateAllLyrics}
                    disabled={!combinedLyrics.trim() || translatingLyrics || (translationLanguage === "other" && !customTranslationLanguage.trim())}
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                    title="Vertaal alle lyric blokken naar de gekozen taal"
                  >
                    {translatingLyrics ? "Vertalen..." : "Translate lyrics"}
                  </button>
                  <button
                    type="button"
                    onClick={copyAllLyrics}
                    disabled={!combinedLyrics}
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {copied ? "Copied!" : "Copy all lyrics"}
                  </button>
                  <button
                    type="button"
                    onClick={useInStudio}
                    disabled={!combinedLyrics}
                    className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Use in Studio →
                  </button>
                </div>
              </section>

              {/* Derde kolom rechts van lyric blocks */}
              <aside className="hidden lg:block">
                <div className="h-full rounded-2xl border border-white/10 bg-[#181820]/80 p-4 flex flex-col gap-4">
                  <div className="min-h-[220px] rounded-xl border border-white/10 bg-[#11111a] p-3">
                    <h3 className="text-white/60 text-sm font-semibold mb-3">Song Flow</h3>
                    <div className="h-[calc(100%-1.75rem)] overflow-auto">
                      <Flowchart blocks={blocks.map(b => ({ label: b.label, type: b.type }))} />
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-[#11111a] p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-white/70 text-sm font-semibold">Style Suggestion</h3>
                      <button
                        type="button"
                        onClick={generateStyleSuggestion}
                        disabled={!topic.trim() || !mood.trim() || !combinedLyrics.trim() || generatingStyleSuggestion}
                        className="inline-flex items-center justify-center rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Generate style suggestion from topic, mood and lyrics"
                      >
                        {generatingStyleSuggestion ? "Generating..." : "AI Fill"}
                      </button>
                    </div>

                    <textarea
                      value={styleSuggestion}
                      onChange={(event) => setStyleSuggestion(event.target.value)}
                      placeholder="AI style suggestion will appear here"
                      className="min-h-[120px] w-full resize-y rounded-xl border border-white/10 bg-[#0f0f16] px-3 py-2 text-xs leading-5 text-white/90 outline-none transition placeholder:text-white/25 focus:border-primary-500/60"
                    />

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-white/35">Based on topic, mood and current lyrics.</p>
                      <button
                        type="button"
                        onClick={copyStyleSuggestion}
                        disabled={!styleSuggestion.trim()}
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {copiedStyleSuggestion ? "Copied" : "Copy"}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={useLyricsAndStyleInStudio}
                      disabled={!combinedLyrics.trim() || !(styleSuggestion.trim() || style.trim())}
                      className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-primary-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-40"
                      title="Copy lyrics and style to Studio"
                    >
                      Use lyrics + style in Studio
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
