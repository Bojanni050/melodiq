"use client";

import { useMemo, useRef, useState } from "react";
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
import { buildLyricsStudioDraftPayload } from "@/lib/lyrics-studio-draft";
import type { ConfirmAction, LyricsStudioNotice, LyricStudioSnapshot } from "@/lib/lyrics-studio-types";
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
import { useLyricBlockDrag } from "@/lib/hooks/useLyricBlockDrag";
import { loadSnapshotIntoState, saveSnapshotsToStorage, useLyricsDraft } from "@/lib/hooks/useLyricsDraft";
import { useStudioStore } from "@/lib/store";

export default function LyricsStudioPage() {
  const router = useRouter();
  const draft = useLyricsDraft();
  const {
    topic, setTopic, mood, setMood, style, setStyle,
    blocks, setBlocks, activePreset, setActivePreset,
    lyricCols, setLyricCols, showLyricsSidebar, setShowLyricsSidebar,
    repetitiveChorus, setRepetitiveChorus,
    creativityLevel, setCreativityLevel,
    contextLevel, setContextLevel,
    styleSuggestion, setStyleSuggestion,
    savedSnapshots, setSavedSnapshots,
  } = draft;

  const { language, customLanguage, structure, customStructure, setLanguage, setCustomLanguage, setStructure, setCustomStructure } = useStudioStore();

  const [credits] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatingSong, setGeneratingSong] = useState(false);
  const [showStructureDropdown, setShowStructureDropdown] = useState(false);
  const [generatingStyleSuggestion, setGeneratingStyleSuggestion] = useState(false);
  const [copiedStyleSuggestion, setCopiedStyleSuggestion] = useState(false);
  const [translationLanguage, setTranslationLanguage] = useState("nl");
  const [customTranslationLanguage, setCustomTranslationLanguage] = useState("");
  const [translatingLyrics, setTranslatingLyrics] = useState(false);
  const [translatingBlockId, setTranslatingBlockId] = useState<string | null>(null);
  const [translatedBlocks, setTranslatedBlocks] = useState<Map<string, string>>(new Map());
  const [showTranslationView, setShowTranslationView] = useState(false);
  const [showLoadSnapshots, setShowLoadSnapshots] = useState(false);
  const [showSaveSnapshotModal, setShowSaveSnapshotModal] = useState(false);
  const [snapshotNameInput, setSnapshotNameInput] = useState("");
  const [notice, setNotice] = useState<LyricsStudioNotice | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [pendingPresetName, setPendingPresetName] = useState<string | null>(null);
  const [pendingStudioPayload, setPendingStudioPayload] = useState<{ lyrics: string; style: string } | null>(null);

  const songGenerationAbortRef = useRef<AbortController | null>(null);
  const stopSongGenerationRef = useRef(false);

  const { draggedBlockId, dropTarget, startBlockDrag, startBlockDragFromCard } = useLyricBlockDrag(setBlocks);

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
      payload: buildLyricsStudioDraftPayload({ topic, mood, style, blocks, activePreset, lyricCols, showLyricsSidebar, structure, customStructure, language, customLanguage, repetitiveChorus, creativityLevel, contextLevel, styleSuggestion }),
    };
    const next = [snapshot, ...savedSnapshots].slice(0, 30);
    setSavedSnapshots(next);
    saveSnapshotsToStorage(next);
    setShowSaveSnapshotModal(false);
    setNotice({ type: "success", message: "Lyrics snapshot opgeslagen." });
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
        existingBlocks: contextBlocks.filter((b) => b.id !== block.id).map(({ type, label, content }) => ({ type, label, content })),
        chorusMode: options?.chorusMode, isFirstChorus: options?.isFirstChorus, temperature, topP,
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
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Kon dit blok niet genereren." });
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
    return createPresetBlocks(BLOCK_PRESETS[presetName] || BLOCK_PRESETS.Pop, presetName);
  }

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
        setNotice({ type: "error", message: error instanceof Error ? error.message : "Fout tijdens songgeneratie." });
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
      const res = await fetch("/api/lyric-studio/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: effectiveTranslationLanguage, blocks: blocks.map(({ id, type, label, content }) => ({ id, type, label, content })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setNotice({ type: "error", message: data?.error || "Vertalen is mislukt." }); return; }
      if (!Array.isArray(data?.blocks)) { setNotice({ type: "error", message: "Vertaling gaf een ongeldig antwoord." }); return; }
      const map = new Map<string, string>();
      for (const item of data.blocks) {
        if (typeof item?.id === "string" && typeof item?.content === "string") map.set(item.id, item.content);
      }
      setTranslatedBlocks(map);
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
    if (!effectiveTranslationLanguage.trim()) { setNotice({ type: "error", message: "Kies eerst een doeltaal." }); return; }
    setTranslatingBlockId(blockId);
    try {
      const res = await fetch("/api/lyric-studio/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: effectiveTranslationLanguage, blocks: [{ id: block.id, type: block.type, label: block.label, content: block.content }] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setNotice({ type: "error", message: data?.error || "Vertalen is mislukt." }); return; }
      if (!Array.isArray(data?.blocks) || !data.blocks[0]) { setNotice({ type: "error", message: "Vertaling gaf een ongeldig antwoord." }); return; }
      setTranslatedBlocks(new Map([[blockId, data.blocks[0].content]]));
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
    const hasExisting = Boolean(studio.songIdea.trim() || studio.lyrics.trim() || studio.lyricsContext.trim() || studio.title.trim());
    if (hasExisting) {
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
      const res = await fetch("/api/lyric-studio/style-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, mood, lyrics: combinedLyrics, language: effectiveLanguage, styleHint: style }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setNotice({ type: "error", message: d?.error || "Style suggestion genereren is mislukt." }); return; }
      const data = await res.json();
      if (data?.suggestion && typeof data.suggestion === "string") setStyleSuggestion(data.suggestion);
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
    if (!force) { setConfirmAction("clearAll"); return; }
    setTopic(""); setMood(""); setStyle(""); setBlocks([]); setActivePreset("");
    setLyricCols(2); setShowLyricsSidebar(false); setShowStructureDropdown(false);
    setStructure(""); setCustomStructure(""); setRepetitiveChorus(true);
    setCreativityLevel(5); setContextLevel(5); setLanguage("English"); setCustomLanguage("");
    setStyleSuggestion(""); setCopiedStyleSuggestion(false); setShowLoadSnapshots(false);
    window.localStorage.removeItem("sonara-lyrics-studio");
    setNotice({ type: "info", message: "Lyric Studio is leeggemaakt." });
  }

  function handleConfirmAction() {
    if (confirmAction === "replaceBlocks" && pendingPresetName) {
      setActivePreset(pendingPresetName);
      setBlocks(createPresetBlocks(BLOCK_PRESETS[pendingPresetName], pendingPresetName));
      setPendingPresetName(null);
    } else if (confirmAction === "replaceStudio" && pendingStudioPayload) {
      const studio = useStudioStore.getState();
      studio.reset();
      studio.setLyrics(pendingStudioPayload.lyrics);
      studio.setSongIdea(pendingStudioPayload.style);
      router.push("/");
      setPendingStudioPayload(null);
    } else if (confirmAction === "clearAll") {
      clearAllDraft(true);
    }
    setConfirmAction(null);
  }

  return (
    <div className="flex h-[calc(100vh-var(--player-height))] bg-[#0d0d12] text-white overflow-hidden">
      <Sidebar credits={credits} />

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
                <button type="button" onClick={openSaveSnapshotModal} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white">
                  Save lyrics
                </button>
                <button type="button" onClick={() => setShowLoadSnapshots(true)} disabled={savedSnapshots.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  Load lyrics
                </button>
                <button type="button" onClick={() => clearAllDraft()} className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20">
                  Clear all
                </button>
                <button type="button" onClick={() => setShowLyricsSidebar((v) => !v)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white">
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
              onCancel={() => { setConfirmAction(null); setPendingPresetName(null); setPendingStudioPayload(null); }}
            />

            <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)_340px]">
              <LyricsControlPanel
                topic={topic} mood={mood} style={style}
                selectedLanguage={selectedLanguage} isCustomLanguage={isCustomLanguage}
                customLanguage={customLanguage} structure={structure} customStructure={customStructure}
                showStructureDropdown={showStructureDropdown} activePreset={activePreset}
                repetitiveChorus={repetitiveChorus} creativityLevel={creativityLevel}
                creativityZone={creativityZone} temperature={temperature}
                contextLevel={contextLevel} contextZone={contextZone} topP={topP}
                canGenerateBlocks={canGenerateBlocks} generatingSong={generatingSong}
                blockTypes={BLOCK_TYPES} blockLabels={BLOCK_LABELS} blockColors={BLOCK_COLORS}
                presets={BLOCK_PRESETS} combinedLyrics={combinedLyrics} copied={copied}
                onTopicChange={setTopic} onMoodChange={setMood} onStyleChange={setStyle}
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
                    onStartBlockDrag={startBlockDrag}
                    onStartBlockDragFromCard={startBlockDragFromCard}
                    onMoveBlock={moveBlock} onDuplicateBlock={duplicateBlock}
                    onDeleteBlock={deleteBlock} onUpdateBlock={updateBlock}
                    onGenerateBlock={generateBlock} onTranslateBlock={translateBlock}
                    autoGrowTextarea={autoGrowTextarea}
                  />
                )}

                <LyricsBottomActions
                  blocks={blocks} translationLanguage={translationLanguage}
                  customTranslationLanguage={customTranslationLanguage}
                  translatingLyrics={translatingLyrics} combinedLyrics={combinedLyrics} copied={copied}
                  onTranslationLanguageChange={setTranslationLanguage}
                  onCustomTranslationLanguageChange={setCustomTranslationLanguage}
                  onTranslateAllLyrics={translateAllLyrics}
                  onCopyAllLyrics={copyAllLyrics}
                  onUseInStudio={useInStudio}
                />
              </section>

              <LyricsStudioSidePanel
                blocks={blocks} topic={topic} mood={mood} style={style}
                combinedLyrics={combinedLyrics} styleSuggestion={styleSuggestion}
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
