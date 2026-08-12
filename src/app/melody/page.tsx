"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import StyleControlPanel from "@/components/style-studio/StyleControlPanel";
import StyleSummary from "@/components/style-studio/StyleSummary";
import StyleSnapshotModals from "@/components/style-studio/StyleSnapshotModals";
import StyleConfirmModal from "@/components/style-studio/StyleConfirmModal";
import LyricsNotice from "@/components/lyrics-studio/LyricsNotice";
import LyricsConfirmModal from "@/components/lyrics-studio/LyricsConfirmModal";
import { combineLyrics, BLOCK_LABELS } from "@/lib/lyrics-utils";
import { STRUCTURES } from "@/lib/lyrics-studio-constants";
import { useLyricsDraft } from "@/lib/hooks/useLyricsDraft";
import { useStyleDraft } from "@/lib/hooks/useStyleDraft";
import { useStudioStore, useSidebarStore } from "@/lib/store";
import { buildStyleDraftPayload } from "@/lib/style-studio-draft";
import { isStylePayloadEmpty, buildMusicPrompt } from "@/lib/style-utils";
import type { StyleNotice, StyleConfirmAction, StyleSnapshot } from "@/lib/style-studio-types";
import type { ConfirmAction } from "@/lib/lyrics-studio-types";

export default function MusicBuilderPage() {
  const router = useRouter();
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);

  const lyricsDraft = useLyricsDraft();
  const { topic, mood, style, blocks, vocalistTag } = lyricsDraft;

  const { title, language, customLanguage, structure, customStructure, instrumental, setInstrumental } = useStudioStore();

  const draft = useStyleDraft();
  const {
    savedSnapshots,
    setSavedSnapshots,
    loadSnapshotIntoState,
    ...payloadFields
  } = draft;

  const [credits] = useState<number | null>(null);
  const [notice, setNotice] = useState<StyleNotice | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");
  const [styleConfirmAction, setStyleConfirmAction] = useState<StyleConfirmAction>(null);
  const [pendingSnapshot, setPendingSnapshot] = useState<StyleSnapshot | null>(null);
  const [studioConfirmAction, setStudioConfirmAction] = useState<ConfirmAction>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const combinedLyrics = useMemo(() => combineLyrics(blocks), [blocks]);
  const isCustomLanguage = language === "Other...";
  const effectiveLanguage = isCustomLanguage ? customLanguage.trim() || "Other" : language;
  const hasLyricsContext = Boolean(topic.trim() || mood.trim() || combinedLyrics.trim());

  const payload = {
    primaryGenre: payloadFields.primaryGenre,
    secondaryGenre: payloadFields.secondaryGenre,
    moods: payloadFields.moods,
    instrumentation: payloadFields.instrumentation,
    vocalDirection: payloadFields.vocalDirection,
    tempo: payloadFields.tempo,
    era: payloadFields.era,
    production: payloadFields.production,
    bpm: payloadFields.bpm,
    musicalKey: payloadFields.musicalKey,
    timeSignature: payloadFields.timeSignature,
    melodyCharacter: payloadFields.melodyCharacter,
    harmonyCharacter: payloadFields.harmonyCharacter,
    groove: payloadFields.groove,
    energy: payloadFields.energy,
    instrumentTexture: payloadFields.instrumentTexture,
    vocalNegatives: payloadFields.vocalNegatives,
    productionAxes: payloadFields.productionAxes,
    avoidTags: payloadFields.avoidTags,
  };

  const lyricsCtx = {
    language: effectiveLanguage,
    vocalistTag: vocalistTag !== "auto" ? vocalistTag : undefined,
  };

  const arrangementLabels = useMemo(() => {
    if (blocks.length > 0) return blocks.map((b) => b.label.trim() || BLOCK_LABELS[b.type]);
    if (structure === "manual" && customStructure.trim()) return [customStructure.trim()];
    const preset = STRUCTURES.find((s) => s.value === structure);
    return preset?.label ? [preset.label] : [];
  }, [blocks, structure, customStructure]);

  function handleSaveClick() {
    if (isStylePayloadEmpty(payload)) {
      setNotice({ type: "error", message: "Music Builder is leeg. Vul eerst enkele properties in." });
      return;
    }
    setSnapshotName("");
    setShowSaveModal(true);
  }

  function handleConfirmSave() {
    const trimmed = snapshotName.trim();
    if (!trimmed) return;
    const snapshot: StyleSnapshot = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: new Date().toISOString(),
      payload: buildStyleDraftPayload(payload),
    };
    const next = [snapshot, ...savedSnapshots].slice(0, 30);
    setSavedSnapshots(next);
    setShowSaveModal(false);
    setSnapshotName("");
    setNotice({ type: "success", message: `"${trimmed}" is opgeslagen.` });
  }

  function handleLoadClick() {
    if (savedSnapshots.length === 0) {
      setNotice({ type: "info", message: "Geen opgeslagen instellingen om te laden." });
      return;
    }
    setShowLoadModal(true);
  }

  function handleLoadSnapshot(snapshot: StyleSnapshot) {
    if (!isStylePayloadEmpty(payload)) {
      setPendingSnapshot(snapshot);
      setStyleConfirmAction("replaceStyle");
      return;
    }
    loadSnapshotIntoState(snapshot);
    setShowLoadModal(false);
    setNotice({ type: "success", message: `"${snapshot.name}" is geladen.` });
  }

  function handleDeleteSnapshot(id: string) {
    setSavedSnapshots(savedSnapshots.filter((s) => s.id !== id));
    setNotice({ type: "info", message: "Verwijderd." });
  }

  function handleStyleConfirmAction() {
    if (styleConfirmAction === "replaceStyle" && pendingSnapshot) {
      loadSnapshotIntoState(pendingSnapshot);
      setShowLoadModal(false);
      setNotice({ type: "success", message: `"${pendingSnapshot.name}" is geladen.` });
    }
    setPendingSnapshot(null);
    setStyleConfirmAction(null);
  }

  function useInStudio() {
    const prompt = buildMusicPrompt(payload, instrumental, lyricsCtx);
    const nextLyrics = instrumental ? "" : combinedLyrics.trim();
    const nextTitle = title.trim();
    if (!prompt.trim()) return;
    const studio = useStudioStore.getState();
    const hasExisting = Boolean(studio.songIdea.trim() || studio.lyrics.trim() || studio.title.trim());
    if (hasExisting) {
      sessionStorage.setItem(
        "lyrics-studio-payload-pending",
        JSON.stringify({ lyrics: nextLyrics, style: prompt, title: nextTitle })
      );
      setStudioConfirmAction("replaceStudio");
      return;
    }
    sessionStorage.setItem("lyrics-studio-payload", JSON.stringify({ lyrics: nextLyrics, style: prompt, title: nextTitle }));
    router.push("/studio");
  }

  function handleStudioConfirmAction() {
    if (studioConfirmAction === "replaceStudio") {
      const raw = sessionStorage.getItem("lyrics-studio-payload-pending");
      sessionStorage.removeItem("lyrics-studio-payload-pending");
      if (raw) {
        sessionStorage.setItem("lyrics-studio-payload", raw);
        router.push("/studio");
      }
    }
    setStudioConfirmAction(null);
  }

  return (
    <div
      className="flex h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] bg-[#0d0d12] text-white overflow-hidden"
      style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 0 }}
    >
      <Sidebar credits={credits} />

      <main className="flex-1 flex flex-col overflow-hidden pt-[53px] lg:pt-0">
        <div className="flex-1 overflow-y-auto">
          <div className="w-full px-4 py-6 lg:px-6 lg:py-8">
            <LyricsNotice notice={notice} onClose={() => setNotice(null)} />

            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold mb-2">Melody</h1>
                <p className="text-white/60">You wrote your song. Now decide how it sounds.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveClick}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleLoadClick}
                  disabled={savedSnapshots.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Load
                </button>
              </div>
            </div>

            {/* YOUR SONG — read-only context from Lyrics */}
            <div className="mb-6 rounded-2xl border border-white/10 bg-[#101018]/80 p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">Your Song</h2>
                <button
                  type="button"
                  onClick={() => router.push("/lyrics-studio")}
                  className="text-xs text-primary-400 underline underline-offset-2 hover:text-primary-300"
                >
                  Edit source
                </button>
              </div>
              {hasLyricsContext || instrumental ? (
                <div className="flex flex-wrap gap-2 text-xs text-white/60">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                    {instrumental ? "Instrumental" : "Song with lyrics"}
                  </span>
                  {effectiveLanguage && <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{effectiveLanguage}</span>}
                  {topic.trim() && <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Topic: {topic}</span>}
                  {mood.trim() && <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Mood: {mood}</span>}
                  {style.trim() && <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Style: {style}</span>}
                  {!instrumental && vocalistTag !== "auto" && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Vocal: {vocalistTag}</span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-white/45">
                  Nog geen lyrics-context. Schrijf eerst topic, mood en lyrics in{" "}
                  <button type="button" onClick={() => router.push("/lyrics-studio")} className="text-primary-400 underline underline-offset-2 hover:text-primary-300">
                    Lyrics
                  </button>
                  , of markeer dit project als Instrumental hieronder.
                </p>
              )}

              <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={instrumental}
                  onClick={() => setInstrumental(!instrumental)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${instrumental ? "bg-amber-500/30" : "bg-white/10"}`}
                >
                  <span className="sr-only">Instrumental</span>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${instrumental ? "translate-x-5" : ""}`} />
                </button>
                <span className="text-sm text-white/60">Instrumental (no vocals, no lyrics)</span>
              </div>
            </div>

            <StyleSnapshotModals
              showSave={showSaveModal}
              showLoad={showLoadModal}
              snapshotName={snapshotName}
              setSnapshotName={setSnapshotName}
              onConfirmSave={handleConfirmSave}
              onCancelSave={() => {
                setShowSaveModal(false);
                setSnapshotName("");
              }}
              savedSnapshots={savedSnapshots}
              onLoad={handleLoadSnapshot}
              onDelete={handleDeleteSnapshot}
              onCancelLoad={() => setShowLoadModal(false)}
            />

            <StyleConfirmModal
              confirmAction={styleConfirmAction}
              onConfirm={handleStyleConfirmAction}
              onCancel={() => {
                setStyleConfirmAction(null);
                setPendingSnapshot(null);
              }}
            />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <StyleControlPanel
                primaryGenre={payloadFields.primaryGenre}
                setPrimaryGenre={payloadFields.setPrimaryGenre}
                secondaryGenre={payloadFields.secondaryGenre}
                setSecondaryGenre={payloadFields.setSecondaryGenre}
                moods={payloadFields.moods}
                setMoods={payloadFields.setMoods}
                instrumentation={payloadFields.instrumentation}
                setInstrumentation={payloadFields.setInstrumentation}
                vocalDirection={payloadFields.vocalDirection}
                setVocalDirection={payloadFields.setVocalDirection}
                tempo={payloadFields.tempo}
                setTempo={payloadFields.setTempo}
                era={payloadFields.era}
                setEra={payloadFields.setEra}
                production={payloadFields.production}
                setProduction={payloadFields.setProduction}
                bpm={payloadFields.bpm}
                setBpm={payloadFields.setBpm}
                musicalKey={payloadFields.musicalKey}
                setMusicalKey={payloadFields.setMusicalKey}
                timeSignature={payloadFields.timeSignature}
                setTimeSignature={payloadFields.setTimeSignature}
                melodyCharacter={payloadFields.melodyCharacter}
                setMelodyCharacter={payloadFields.setMelodyCharacter}
                harmonyCharacter={payloadFields.harmonyCharacter}
                setHarmonyCharacter={payloadFields.setHarmonyCharacter}
                groove={payloadFields.groove}
                setGroove={payloadFields.setGroove}
                energy={payloadFields.energy}
                setEnergy={payloadFields.setEnergy}
                instrumentTexture={payloadFields.instrumentTexture}
                setInstrumentTexture={payloadFields.setInstrumentTexture}
                vocalNegatives={payloadFields.vocalNegatives}
                setVocalNegatives={payloadFields.setVocalNegatives}
                productionAxes={payloadFields.productionAxes}
                setProductionAxes={payloadFields.setProductionAxes}
                avoidTags={payloadFields.avoidTags}
                setAvoidTags={payloadFields.setAvoidTags}
                instrumental={instrumental}
              />

              <aside className="flex flex-col gap-4 lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:pr-1">
                {arrangementLabels.length > 0 && (
                  <section className="rounded-2xl border border-white/10 bg-[#101018]/80 p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-white/85">Arrangement</h3>
                    <p className="text-xs text-white/40">Structure comes from your lyrics — edit it there if needed.</p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-white/70">
                      {arrangementLabels.map((label, i) => (
                        <span key={`${label}-${i}`} className="flex items-center gap-1.5">
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{label}</span>
                          {i < arrangementLabels.length - 1 && <span className="text-white/20">→</span>}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                <StyleSummary payload={payload} instrumental={instrumental} lyricsCtx={lyricsCtx} />

                <button
                  type="button"
                  onClick={useInStudio}
                  disabled={isStylePayloadEmpty(payload)}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-primary-gradient px-3 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Use in Studio
                </button>
              </aside>
            </div>
          </div>
        </div>
      </main>

      <LyricsConfirmModal
        confirmAction={studioConfirmAction}
        onConfirm={handleStudioConfirmAction}
        onCancel={() => setStudioConfirmAction(null)}
      />
    </div>
  );
}
