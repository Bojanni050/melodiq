"use client";

import { memo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GenerateButton from "@/components/studio/GenerateButton";
import VoiceCloneToggle from "@/components/studio/VoiceCloneToggle";
import ProviderModelSection, { type ProviderCredits } from "@/components/studio/ProviderModelSection";
import TitleSection from "@/components/studio/TitleSection";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useStudioStore, usePresetsStore } from "@/lib/store";

export default memo(function StudioForm({
  credits,
  isGenerating,
  onGenerate,
  onOptimize,
  onGenerateTitle,
}: {
  credits: ProviderCredits;
  isGenerating: boolean;
  onGenerate: () => void;
  onOptimize: () => void;
  onGenerateTitle: (lyrics: string) => Promise<string | null>;
}) {
  const router = useRouter();
  const {
    songIdea,
    lyrics,
    title,
    autoCreateWorkspaceFromGeneratedTitle,
    selectedProviders,
    rememberProviderChoice,
    instrumental,
    vocalGender,
    weirdness,
    styleInfluence,
    audioWeight,
    negativeTags,
    usePersonaVoice,
    savedLyrics,
    savedLyricsLoaded,
    setSongIdea,
    setLyrics,
    setTitle,
    setAutoCreateWorkspaceFromGeneratedTitle,
    setProvider,
    toggleProvider,
    setProviderModel,
    setRememberProviderChoice,
    setInstrumental,
    setVocalGender,
    setWeirdness,
    setStyleInfluence,
    setAudioWeight,
    setNegativeTags,
    fetchSavedLyrics,
    saveLyric,
    loadSavedLyric,
    deleteSavedLyric,
    reset,
  } = useStudioStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showVocalGenderConfirm, setShowVocalGenderConfirm] = useState(false);
  const [showEmptyLyricsConfirm, setShowEmptyLyricsConfirm] = useState(false);

  useEffect(() => {
    if (!savedLyricsLoaded) {
      void fetchSavedLyrics();
    }
  }, [savedLyricsLoaded, fetchSavedLyrics]);

  const [optimizing, setOptimizing] = useState(false);
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [showProTips, setShowProTips] = useState(false);
  const [copiedField, setCopiedField] = useState<"lyrics" | "style" | null>(null);
  const [lyricsExpanded, setLyricsExpanded] = useState(false);
  const [showSavedLyrics, setShowSavedLyrics] = useState(false);
  const [lyricsSaved, setLyricsSaved] = useState(false);

  // Saved presets store hooks and local UI states
  const presets = usePresetsStore((state) => state.presets);
  const presetsLoaded = usePresetsStore((state) => state.presetsLoaded);
  const fetchPresets = usePresetsStore((state) => state.fetchPresets);
  const addPreset = usePresetsStore((state) => state.addPreset);
  const deletePreset = usePresetsStore((state) => state.deletePreset);

  useEffect(() => {
    if (!presetsLoaded) {
      void fetchPresets();
    }
  }, [presetsLoaded, fetchPresets]);

  const [showSavePresetForm, setShowSavePresetForm] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetNotes, setPresetNotes] = useState("");
  const [showSavedPresetsList, setShowSavedPresetsList] = useState(false);
  const [loadedPresetId, setLoadedPresetId] = useState<string | null>(null);

  useEffect(() => {
    if (!lyricsExpanded) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLyricsExpanded(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lyricsExpanded]);
  const [providersCollapsed, setProvidersCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem("melodiq-providers-collapsed") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("melodiq-providers-collapsed", String(providersCollapsed));
    } catch {
      // ignore
    }
  }, [providersCollapsed]);

  const activeProviderKey = Object.keys(selectedProviders)[0];
  const isHeartMulaSelected = activeProviderKey === "heartmula";
  const promptCharCount = songIdea.length;
  const styleMaxChars = 1000;
  const lyricsCharCount = lyrics.length;
  const lyricsMaxChars = activeProviderKey === "apimart" ? 5000 : 3000;
  const [showStyleTooLongConfirm, setShowStyleTooLongConfirm] = useState(false);

  // Generate button logic:
  // - At least one provider must be selected
  // - Style/prompt is always required
  // - Lyrics are optional (providers can generate vocal output without explicit lyrics)
  const canGenerate =
    Object.keys(selectedProviders).length > 0 &&
    !!songIdea.trim();

  async function handleOptimize() {
    if (!songIdea) return;
    setOptimizing(true);
    try {
      await onOptimize();
    } finally {
      setOptimizing(false);
    }
  }

  async function handleGenerateTitle() {
    if (!lyrics.trim()) return;
    setGeneratingTitle(true);
    try {
      const result = await onGenerateTitle(lyrics);
      if (result) {
        setTitle(result);
      }
    } finally {
      setGeneratingTitle(false);
    }
  }

  async function handleCopy(text: string, field: "lyrics" | "style") {
    if (!text.trim()) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error("Failed to copy field:", error);
    }
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4">
      {/* Top Bar: Studio Header & Clear All */}
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold tracking-tight text-white/90">Music</h2>
        <button
          type="button"
          onClick={() => setShowClearConfirm(true)}
          className="btn-secondary text-sm px-3 py-1.5"
        >
          Clear All
        </button>
      </div>

      {showClearConfirm && (
        <ConfirmModal
          icon={
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          }
          iconBgClassName="bg-red-500/20"
          message="Clear all Studio input? Song idea, lyrics, title and style settings will all be reset."
          cancelLabel="Cancel"
          confirmLabel="Clear all"
          confirmClassName="border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/20"
          onCancel={() => setShowClearConfirm(false)}
          onConfirm={() => {
            reset();
            setShowClearConfirm(false);
          }}
        />
      )}

      {showVocalGenderConfirm && (
        <ConfirmModal
          icon={
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          }
          iconBgClassName="bg-amber-500/20"
          message="Geen Vocal Gender gekozen. Het model kiest zelf een stem. Is dat de bedoeling?"
          cancelLabel="Annuleren"
          confirmLabel="Doorgaan"
          confirmClassName="border-amber-400/20 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
          onCancel={() => setShowVocalGenderConfirm(false)}
          onConfirm={() => {
            setShowVocalGenderConfirm(false);
            onGenerate();
          }}
        />
      )}

      {showEmptyLyricsConfirm && (
        <ConfirmModal
          widthClassName="w-[26rem]"
          icon={
            <svg className="w-4 h-4 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          }
          iconSizeClassName="w-9 h-9"
          iconBgClassName="bg-violet-500/20"
          message={
            <>
              <p className="text-sm font-semibold text-white mb-1">No lyrics entered</p>
              <p className="text-sm text-white/65 leading-relaxed">
                The lyrics field is empty. The AI provider will make up its own lyrics. Continue anyway?
              </p>
            </>
          }
          cancelLabel="Cancel"
          confirmLabel="Continue anyway"
          confirmClassName="border-violet-400/25 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25"
          onCancel={() => setShowEmptyLyricsConfirm(false)}
          onConfirm={() => {
            setShowEmptyLyricsConfirm(false);
            if (!instrumental && vocalGender === "auto") {
              setShowVocalGenderConfirm(true);
            } else {
              onGenerate();
            }
          }}
        />
      )}

      {showStyleTooLongConfirm && (
        <ConfirmModal
          icon={
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          }
          iconBgClassName="bg-red-500/20"
          message={`Style & Prompt is te lang (${promptCharCount}/${styleMaxChars} karakters). Er is niets naar de provider gestuurd. Wil je de prompt automatisch laten optimaliseren, of pas je hem liever zelf aan?`}
          cancelLabel="Zelf aanpassen"
          confirmLabel="Optimaliseren"
          confirmClassName="border-primary-400/30 bg-primary-500/15 text-primary-200 hover:bg-primary-500/25"
          onCancel={() => setShowStyleTooLongConfirm(false)}
          onConfirm={() => {
            setShowStyleTooLongConfirm(false);
            void handleOptimize();
          }}
        />
      )}

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-4 pr-1">

      <ProviderModelSection
        credits={credits}
        selectedProviders={selectedProviders}
        rememberProviderChoice={rememberProviderChoice}
        setProvider={setProvider}
        setProviderModel={setProviderModel}
        setRememberProviderChoice={setRememberProviderChoice}
      />

      {/* Lyrics Section */}

      <section className="section-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white/80">Lyrics</h3>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${instrumental ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "bg-primary-500/20 text-primary-400 border border-primary-500/30"}`}>
              {instrumental ? "INSTRUMENTAL" : "VOCAL"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={instrumental}
              onClick={() => setInstrumental(!instrumental)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                instrumental ? "bg-amber-500/20" : "bg-emerald-500/20"
              }`}
            >
              <span className="sr-only">Instrumental</span>
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  instrumental ? "translate-x-6" : ""
                }`}
              />
              <span className="absolute left-1 top-0.5 text-[9px] font-bold text-white/60">V</span>
              <span className="absolute right-1 top-0.5 text-[9px] font-bold text-white/60">I</span>
            </button>
          </div>
        </div>

        {isHeartMulaSelected && (
          <p className="text-sm text-white/30 italic mb-2">
            HeartMuLa reads structure directly from your lyrics — write your own tags: <span className="text-white/50 font-mono">[Verse]</span>, <span className="text-white/50 font-mono">[Chorus]</span>, <span className="text-white/50 font-mono">[Bridge]</span>, plus instrumental sections like <span className="text-white/50 font-mono">[intro-short]</span>, <span className="text-white/50 font-mono">[inst-medium]</span>, <span className="text-white/50 font-mono">[outro-short]</span>.
          </p>
        )}
        {(!instrumental || isHeartMulaSelected) && (
          <>
            <div className="relative">
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder={isHeartMulaSelected ? `Write your lyrics here, including structure tags...

[Verse]
Your lyrics here

[Chorus]
Your chorus here

[intro-short]
[outro-short]` : `Write your lyrics here...

[Verse]
Your lyrics here

[Chorus]
Your chorus here`}
                className="input-field min-h-[220px] resize-y text-base leading-relaxed"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/melody")}
                  className="btn-ghost text-sm flex items-center gap-1.5"
                  title="Write and generate lyrics in Melody"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Generate Lyrics
                </button>
                <button
                  type="button"
                  onClick={() => setLyricsExpanded(true)}
                  className="btn-ghost text-sm flex items-center gap-1.5"
                  title="Expand lyrics editor"
                  aria-label="Expand lyrics editor"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  </svg>
                  Expand Editor
                </button>
              </div>

              <div className="flex items-center gap-1.5 bg-[#12121a]/85 px-2 py-1 rounded-lg border border-white/5 shadow-md">
                <button
                  type="button"
                  onClick={() => handleCopy(lyrics, "lyrics")}
                  disabled={!lyrics.trim()}
                  className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Copy lyrics"
                  aria-label="Copy lyrics"
                >
                  {copiedField === "lyrics" ? (
                    <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!lyrics.trim()) return;
                    const result = await saveLyric();
                    if (result) {
                      setLyricsSaved(true);
                      setTimeout(() => setLyricsSaved(false), 1500);
                    }
                  }}
                  disabled={!lyrics.trim()}
                  className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Save lyrics"
                  aria-label="Save lyrics"
                >
                  {lyricsSaved ? (
                    <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h6l4 4v12a2 2 0 01-2 2H7a2 2 0 01-2-2V5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3v4h-6V3" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setLyrics("")}
                  disabled={!lyrics.trim()}
                  className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Clear lyrics"
                  aria-label="Clear lyrics"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <div className="h-3.5 w-px bg-white/10" />
                <span className={`text-[10px] font-mono select-none ${
                  lyricsCharCount >= lyricsMaxChars ? "text-red-400" : "text-white/30"
                }`}>
                  {lyricsCharCount}/{lyricsMaxChars}
                </span>
              </div>
            </div>

            {/* Saved lyrics panel */}
            {savedLyrics.length > 0 && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setShowSavedLyrics((v) => !v)}
                  className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/65 transition-colors"
                >
                  <svg className={`w-3 h-3 transition-transform ${showSavedLyrics ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Saved lyrics ({savedLyrics.length})
                </button>
                {showSavedLyrics && (
                  <div className="mt-1.5 space-y-1 max-h-48 overflow-y-auto rounded-lg border border-white/8 bg-[#0d0d12] p-1.5">
                    {savedLyrics.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5 group">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white/75 truncate">{entry.title}</p>
                          <p className="text-[10px] text-white/30">{new Date(entry.savedAt).toLocaleDateString()}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => loadSavedLyric(entry.id)}
                          className="shrink-0 text-[10px] text-white/40 hover:text-white/80 transition-colors px-1.5 py-0.5 rounded hover:bg-white/10"
                          title="Load these lyrics"
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteSavedLyric(entry.id)}
                          className="shrink-0 opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all p-0.5 rounded hover:bg-red-500/10"
                          title="Delete"
                          aria-label="Delete saved lyrics"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {instrumental && !isHeartMulaSelected && (
          <p className="text-sm text-white/30 italic">
            🎵 <span className="text-white/50">Instrumental mode</span> — no lyrics needed, focus on the style prompt
          </p>
        )}
      </section>

      {/* Expanded lyrics overlay */}
      {lyricsExpanded && (
        <div
          className="absolute inset-0 z-50 flex flex-col bg-[#0d0d12]/98 backdrop-blur-sm p-4 rounded-xl"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white/80">Lyrics</h3>
              <span className={`text-xs text-white/30`}>{lyricsCharCount}/{lyricsMaxChars}</span>
            </div>
            <button
              type="button"
              onClick={() => setLyricsExpanded(false)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition"
              title="Collapse lyrics editor"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
              Close
            </button>
          </div>
          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder={isHeartMulaSelected
              ? `Write your lyrics here, including structure tags...\n\n[Verse]\nYour lyrics here\n\n[Chorus]\nYour chorus here\n\n[intro-short]\n[outro-short]`
              : `Write your lyrics here...\n\n[Verse]\nYour lyrics here\n\n[Chorus]\nYour chorus here`}
            className="flex-1 w-full rounded-xl border border-white/10 bg-white/5 p-4 text-base leading-relaxed text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-primary-500/50 resize-none"
            autoFocus
          />
        </div>
      )}

      {/* Style Section */}
      <section className="section-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white/80">{isHeartMulaSelected ? "Style Tags" : "Style & Prompt"}</h3>
        </div>
        {isHeartMulaSelected && (
          <p className="text-sm text-white/30 italic mb-2">
            Comma-separated style descriptors — gender, timbre, genre, emotion, instruments, tempo (e.g. 85bpm)
          </p>
        )}

        <div className="relative">
          <textarea
            value={songIdea}
            onChange={(e) => setSongIdea(e.target.value)}
            placeholder={isHeartMulaSelected
              ? `e.g. "female, warm, indie folk, bittersweet, acoustic guitar and piano, 85bpm"`
              : `Describe your song style... e.g. "Dark Dutch Folk, subdued introspective, piano with sparse arrangement"`}
            className="input-field min-h-[120px] resize-y text-sm leading-relaxed"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/melody")}
              className="btn-ghost text-sm flex items-center gap-1.5"
              title="Build your style in Melody"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Style
            </button>

            <button
              type="button"
              disabled={!songIdea.trim()}
              onClick={() => {
                setShowSavePresetForm(!showSavePresetForm);
                setPresetName("");
                setPresetNotes("");
              }}
              className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Sla huidige stijl op als preset"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save Preset
            </button>

            {presets.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSavedPresetsList(!showSavedPresetsList)}
                className={`btn-ghost text-sm flex items-center gap-1.5 ${showSavedPresetsList ? "text-primary-300 font-semibold" : "text-white/60 hover:text-white"}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                My Presets ({presets.length})
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-[#12121a]/85 px-2 py-1 rounded-lg border border-white/5 shadow-md">
            <button
              type="button"
              onClick={() => handleCopy(songIdea, "style")}
              disabled={!songIdea.trim()}
              className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Copy style"
              aria-label="Copy style"
            >
              {copiedField === "style" ? (
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={() => setSongIdea("")}
              disabled={!songIdea.trim()}
              className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Clear style"
              aria-label="Clear style"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <div className="h-3.5 w-px bg-white/10" />
            <span
              className={`text-[10px] font-mono select-none ${
                promptCharCount >= styleMaxChars ? "text-red-400" : "text-white/30"
              }`}
            >
              {promptCharCount}/{styleMaxChars}
            </span>
          </div>
        </div>

        {/* Save Preset Form */}
        {showSavePresetForm && (
          <div className="mt-4 p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
            <p className="text-sm font-semibold text-primary-300">Save Style & Prompt Preset</p>
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] text-white/50 mb-1">Preset Name</label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g. Dutch Melancholy, Summer Uplifting"
                  className="input-field text-sm py-1.5 focus:border-primary-500/50 outline-none"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-[10px] text-white/50 mb-1">Notes about this prompt</label>
                <textarea
                  value={presetNotes}
                  onChange={(e) => setPresetNotes(e.target.value)}
                  placeholder="Notes down specific ideas, instruments, or details..."
                  className="input-field text-sm py-1.5 min-h-[60px] resize-y focus:border-primary-500/50 outline-none"
                  maxLength={500}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowSavePresetForm(false)}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!presetName.trim()}
                onClick={async () => {
                  const result = await addPreset(presetName, songIdea, presetNotes);
                  if (result) {
                    setShowSavePresetForm(false);
                    setShowSavedPresetsList(true);
                    setPresetName("");
                    setPresetNotes("");
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-primary-500/80 hover:bg-primary-500 text-sm text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* My Presets List */}
        {showSavedPresetsList && presets.length > 0 && (
          <div className="mt-4 border-t border-white/10 pt-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white/60">My Saved Presets</p>
              <button
                type="button"
                onClick={() => setShowSavedPresetsList(false)}
                className="text-[10px] text-white/40 hover:text-white/60"
              >
                Close list
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {presets.map((preset) => {
                const isLoaded = loadedPresetId === preset.id;
                return (
                  <div
                    key={preset.id}
                    className="flex flex-col gap-1.5 p-3 rounded-lg border border-white/6 bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white/95 truncate">{preset.name}</p>
                        <p className="text-[10px] text-white/30 truncate mt-0.5" title={preset.prompt}>
                          Prompt: {preset.prompt}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setSongIdea(preset.prompt);
                            setLoadedPresetId(preset.id);
                            setTimeout(() => setLoadedPresetId(null), 1500);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                            isLoaded
                              ? "bg-green-500/20 text-green-400 border border-green-500/30"
                              : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
                          }`}
                        >
                          {isLoaded ? "Loaded ✓" : "Load"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deletePreset(preset.id)}
                          className="p-1 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors"
                          title="Delete Preset"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {preset.notes && (
                      <div className="text-[10px] text-white/50 border-l border-primary-500/20 pl-2 py-0.5 bg-primary-500/[0.02] rounded-r">
                        <span className="font-semibold text-white/70">Notes: </span>
                        {preset.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PoYo Sliders — only for PoYo provider */}
        {Object.keys(selectedProviders).length > 0 && Object.keys(selectedProviders)[0] === "poyo" && (
          <>
            <div className="my-4 h-px bg-white/10" />

            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Sliders</h4>
              <button
                type="button"
                onClick={() => setShowProTips(!showProTips)}
                className="flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300 transition-colors"
              >
                <svg className={`w-3 h-3 transition-transform duration-200 ${showProTips ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Pro Tips
              </button>
            </div>

            {showProTips && (
              <div className="mb-4 p-3 rounded-lg bg-primary-500/5 border border-primary-500/20 space-y-2">
                <p className="text-sm text-primary-300 font-medium">Pro Tips for Best Results</p>
                <ul className="text-sm text-white/40 space-y-1.5 list-disc list-inside">
                  <li><span className="text-white/60">Tweak One at a Time:</span> Altering all sliders at once makes it hard to trace what caused a specific output.</li>
                  <li><span className="text-white/60">Detailed Prompts Need Lower Weirdness:</span> Keep Weirdness below 40% with hyper-specific prompts to avoid the AI tripping over itself.</li>
                  <li><span className="text-white/60">Vocal Glitches:</span> If your singer stumbles or hallucinates lyrics, drop Weirdness and Style Influence down to correct the flow.</li>
                </ul>
              </div>
            )}

            {/* Weirdness Slider */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-white/60">Weirdness</label>
                <span className="text-sm text-white/40 font-mono">{weirdness}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/25 uppercase tracking-wider">Safe</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={weirdness}
                  onChange={(e) => setWeirdness(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 cursor-pointer accent-primary-500"
                  style={{
                    background: `linear-gradient(to right, #8b5cf6 ${weirdness}%, rgba(255,255,255,0.1) ${weirdness}%)`,
                  }}
                />
                <span className="text-[10px] text-white/25 uppercase tracking-wider">Chaos</span>
              </div>
              <p className="text-[10px] text-white/25 mt-1">
                {weirdness <= 20 ? "Highly predictable, clean, radio-friendly" : weirdness <= 60 ? "Balanced — standard sounds with interesting choices" : "Experimental — wild instruments, strange effects, spontaneous moments"}
              </p>
            </div>

            {/* Style Influence Slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-white/60">Style Influence</label>
                <span className="text-sm text-white/40 font-mono">{styleInfluence}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/25 uppercase tracking-wider">Loose</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={styleInfluence}
                  onChange={(e) => setStyleInfluence(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 cursor-pointer accent-primary-500"
                  style={{
                    background: `linear-gradient(to right, #8b5cf6 ${styleInfluence}%, rgba(255,255,255,0.1) ${styleInfluence}%)`,
                  }}
                />
                <span className="text-[10px] text-white/25 uppercase tracking-wider">Strong</span>
              </div>
              <p className="text-[10px] text-white/25 mt-1">
                {styleInfluence <= 40 ? "Model has freedom to invent melodies and deviate from genre" : styleInfluence <= 70 ? "Moderate — respects your tags but adds creative variation" : "Strict — forces the model to rigidly obey your style tags"}
              </p>
            </div>
          </>
        )}

        {/* APIMart Sliders — only for APIMart provider */}
        {Object.keys(selectedProviders).length > 0 && Object.keys(selectedProviders)[0] === "apimart" && (
          <>
            <div className="my-4 h-px bg-white/10" />

            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white/60 uppercase tracking-wider">APIMart Settings</h4>
            </div>

            {/* Exclude Styles (Negative Tags) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-white/60 mb-1.5">Exclude Styles</label>
              <input
                type="text"
                placeholder="e.g. vocals, drums, lo-fi"
                value={negativeTags}
                onChange={(e) => setNegativeTags(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
              />
            </div>

            {/* Style Weight */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-white/60">Style weight</label>
                <span className="text-sm text-white/40 font-mono">{(styleInfluence / 100).toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={styleInfluence}
                  onChange={(e) => setStyleInfluence(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 cursor-pointer accent-primary-500"
                  style={{
                    background: `linear-gradient(to right, #8b5cf6 ${styleInfluence}%, rgba(255,255,255,0.1) ${styleInfluence}%)`,
                  }}
                />
              </div>
              <p className="text-[10px] text-white/25 mt-1">Only takes effect when custom=true.</p>
            </div>

            {/* Weirdness Constraint (Creativity) */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-white/60">Creativity (Weirdness)</label>
                <span className="text-sm text-white/40 font-mono">{(weirdness / 100).toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={weirdness}
                  onChange={(e) => setWeirdness(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 cursor-pointer accent-primary-500"
                  style={{
                    background: `linear-gradient(to right, #8b5cf6 ${weirdness}%, rgba(255,255,255,0.1) ${weirdness}%)`,
                  }}
                />
              </div>
              <p className="text-[10px] text-white/25 mt-1">Only takes effect when custom=true.</p>
            </div>

            {/* Audio Weight — only relevant when a cloned/uploaded voice is used */}
            {usePersonaVoice && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-white/60">Audio weight</label>
                  <span className="text-sm text-white/40 font-mono">{(audioWeight / 100).toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={audioWeight}
                    onChange={(e) => setAudioWeight(Number(e.target.value))}
                    className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 cursor-pointer accent-primary-500"
                    style={{
                      background: `linear-gradient(to right, #8b5cf6 ${audioWeight}%, rgba(255,255,255,0.1) ${audioWeight}%)`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-white/25 mt-1">Only takes effect when custom=true.</p>
              </div>
            )}
          </>
        )}

        {/* APIMart voice cloning — only for APIMart provider */}
        {Object.keys(selectedProviders).length > 0 && Object.keys(selectedProviders)[0] === "apimart" && (
          <>
            <div className="my-4 h-px bg-white/10" />
            <VoiceCloneToggle />
          </>
        )}
      </section>

      {!instrumental && (
        <section className="section-card">
          <h3 className="text-sm font-semibold text-white/80 mb-3">Vocal Gender</h3>
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            <button
              type="button"
              onClick={() => setVocalGender(vocalGender === "female" ? "auto" : "female")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                vocalGender === "female"
                  ? "bg-pink-500/30 text-pink-300"
                  : "bg-white/5 text-white/40 hover:bg-white/10"
              }`}
            >
              👩‍🎤 Female
            </button>
            <button
              type="button"
              onClick={() => setVocalGender(vocalGender === "male" ? "auto" : "male")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                vocalGender === "male"
                  ? "bg-blue-500/30 text-blue-300"
                  : "bg-white/5 text-white/40 hover:bg-white/10"
              }`}
            >
              👨‍🎤 Male
            </button>
          </div>
        </section>
      )}

      <TitleSection
        title={title}
        setTitle={setTitle}
        instrumental={instrumental}
        lyrics={lyrics}
        generatingTitle={generatingTitle}
        onGenerateTitle={handleGenerateTitle}
      />
      </div>

      {/* Generate Button */}
      <div className="sticky bottom-0 z-10 space-y-2 rounded-xl border border-white/10 bg-[#11111a]/95 p-3 backdrop-blur-sm">
        <label className="flex items-start gap-2.5 text-sm text-white/70">
          <input
            type="checkbox"
            checked={autoCreateWorkspaceFromGeneratedTitle}
            onChange={(e) => setAutoCreateWorkspaceFromGeneratedTitle(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-white/30 bg-white/5 text-primary-500 focus:ring-primary-500/40"
          />
          <span>
            Auto-create workspace from generated title and open it
          </span>
        </label>

        <GenerateButton
          onClick={() => {
            if (songIdea.length > styleMaxChars) {
              setShowStyleTooLongConfirm(true);
              return;
            }
            if (!instrumental && !lyrics.trim()) {
              setShowEmptyLyricsConfirm(true);
              return;
            }
            if (!instrumental && vocalGender === "auto") {
              setShowVocalGenderConfirm(true);
            } else {
              onGenerate();
            }
          }}
          loading={isGenerating}
          disabled={!canGenerate}
          label="🎶 Generate Track"
          loadingLabel="Generating..."
          className="w-full py-3 text-sm tracking-wide"
        />

        {/* Validation hint when button is disabled */}
        {!canGenerate && (
          <p className="text-center text-sm text-red-400/60">
            {Object.keys(selectedProviders).length === 0
              ? "Select at least one provider"
              : "Describe a style or prompt to continue"}
          </p>
        )}
      </div>
    </div>
  );
});
