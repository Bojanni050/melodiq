"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import StyleControlPanel from "@/components/style-studio/StyleControlPanel";
import StyleSummary from "@/components/style-studio/StyleSummary";
import StyleIQPlaceholder from "@/components/style-studio/StyleIQPlaceholder";
import StyleSnapshotModals from "@/components/style-studio/StyleSnapshotModals";
import StyleConfirmModal from "@/components/style-studio/StyleConfirmModal";
import LyricsNotice from "@/components/lyrics-studio/LyricsNotice";
import { useStyleDraft } from "@/lib/hooks/useStyleDraft";
import { useSidebarStore } from "@/lib/store";
import { buildStyleDraftPayload } from "@/lib/style-studio-draft";
import { isStylePayloadEmpty } from "@/lib/style-utils";
import type { StyleNotice, StyleConfirmAction } from "@/lib/style-studio-types";
import type { StyleSnapshot } from "@/lib/style-studio-types";

export default function StyleStudioPage() {
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);
  const draft = useStyleDraft();
  const {
    primaryGenre,
    setPrimaryGenre,
    secondaryGenre,
    setSecondaryGenre,
    moods,
    setMoods,
    instrumentation,
    setInstrumentation,
    vocalDirection,
    setVocalDirection,
    tempo,
    setTempo,
    era,
    setEra,
    production,
    setProduction,
    savedSnapshots,
    setSavedSnapshots,
    loadSnapshotIntoState,
  } = draft;

  const [credits] = useState<number | null>(null);
  const [notice, setNotice] = useState<StyleNotice | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");
  const [confirmAction, setConfirmAction] = useState<StyleConfirmAction>(null);
  const [pendingSnapshot, setPendingSnapshot] = useState<StyleSnapshot | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const payload = {
    primaryGenre,
    secondaryGenre,
    moods,
    instrumentation,
    vocalDirection,
    tempo,
    era,
    production,
  };

  function handleSaveClick() {
    if (isStylePayloadEmpty(payload)) {
      setNotice({ type: "error", message: "Style is leeg. Vul eerst enkele properties in." });
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
    setNotice({ type: "success", message: `Style "${trimmed}" is opgeslagen.` });
  }

  function handleLoadClick() {
    if (savedSnapshots.length === 0) {
      setNotice({ type: "info", message: "Geen opgeslagen styles om te laden." });
      return;
    }
    setShowLoadModal(true);
  }

  function handleLoadSnapshot(snapshot: StyleSnapshot) {
    if (!isStylePayloadEmpty(payload)) {
      setPendingSnapshot(snapshot);
      setConfirmAction("replaceStyle");
      return;
    }
    loadSnapshotIntoState(snapshot);
    setShowLoadModal(false);
    setNotice({ type: "success", message: `Style "${snapshot.name}" is geladen.` });
  }

  function handleDeleteSnapshot(id: string) {
    const next = savedSnapshots.filter((s) => s.id !== id);
    setSavedSnapshots(next);
    setNotice({ type: "info", message: "Style verwijderd." });
  }

  function handleClearClick() {
    if (isStylePayloadEmpty(payload)) {
      setNotice({ type: "info", message: "Style is al leeg." });
      return;
    }
    setConfirmAction("clearAll");
  }

  function handleConfirmAction() {
    if (confirmAction === "clearAll") {
      setPrimaryGenre("");
      setSecondaryGenre("");
      setMoods([]);
      setInstrumentation([]);
      setVocalDirection([]);
      setTempo("");
      setEra("");
      setProduction([]);
      setNotice({ type: "info", message: "Style is leeggemaakt." });
    } else if (confirmAction === "replaceStyle" && pendingSnapshot) {
      loadSnapshotIntoState(pendingSnapshot);
      setShowLoadModal(false);
      setNotice({ type: "success", message: `Style "${pendingSnapshot.name}" is geladen.` });
    }
    setPendingSnapshot(null);
    setConfirmAction(null);
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

            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold mb-2">Style</h1>
                <p className="text-white/60">Define the musical identity of your song.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveClick}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  Save Style
                </button>
                <button
                  type="button"
                  onClick={handleLoadClick}
                  disabled={savedSnapshots.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Load Style
                </button>
                <button
                  type="button"
                  onClick={handleClearClick}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
                >
                  Clear
                </button>
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
              confirmAction={confirmAction}
              onConfirm={handleConfirmAction}
              onCancel={() => {
                setConfirmAction(null);
                setPendingSnapshot(null);
              }}
            />

            <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)_340px]">
              <StyleControlPanel
                primaryGenre={primaryGenre}
                setPrimaryGenre={setPrimaryGenre}
                secondaryGenre={secondaryGenre}
                setSecondaryGenre={setSecondaryGenre}
                moods={moods}
                setMoods={setMoods}
                instrumentation={instrumentation}
                setInstrumentation={setInstrumentation}
                vocalDirection={vocalDirection}
                setVocalDirection={setVocalDirection}
                tempo={tempo}
                setTempo={setTempo}
                era={era}
                setEra={setEra}
                production={production}
                setProduction={setProduction}
              />

              <section className="min-h-[620px] rounded-2xl border border-white/10 bg-[#101018]/80 p-5 space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-white/90">Style Workflow</h2>
                  <p className="text-sm text-white/50 mt-1">
                    Lyrics → Style → Music. Define the musical identity on the left. The right column
                    shows the live summary and future StyleIQ.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">Provider-neutral</p>
                  <p className="text-sm text-white/70 leading-relaxed">
                    This page is fully provider-neutral. Suno, Mureka, Tempolor and future providers
                    are hidden from view. You describe musical intent — MelodiQ translates that into
                    provider-specific prompts via PromptIQ.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">Next step</p>
                  <p className="text-sm text-white/70 leading-relaxed">
                    Once your Style is defined, head to the Music page to generate audio. The Style
                    Summary will be available as input for PromptIQ.
                  </p>
                </div>
              </section>

              <aside className="hidden lg:flex flex-col gap-4">
                <StyleSummary payload={payload} />
                <StyleIQPlaceholder />
              </aside>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
