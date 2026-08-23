"use client";

import { memo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GenerateButton from "@/components/studio/GenerateButton";
import VoiceCloneToggle from "@/components/studio/VoiceCloneToggle";
import ProviderModelSection, { type ProviderCredits } from "@/components/studio/ProviderModelSection";
import TitleSection from "@/components/studio/TitleSection";
import SavedLyricsList from "@/components/studio/SavedLyricsList";
import PresetsManager from "@/components/studio/PresetsManager";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useStudioStore } from "@/lib/store";
import { useUserStore } from "@/lib/stores/userStore";
import { useT } from "@/hooks/useT";

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
  const t = useT();
  const router = useRouter();
  const {
    songIdea,
    lyrics,
    title,
    artistName,
    writerName,
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
    setArtistName,
    setWriterName,
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

  const user = useUserStore((state) => state.user);
  const loadUser = useUserStore((state) => state.loadUser);
  useEffect(() => {
    void loadUser();
  }, [loadUser]);
  const artistAliasOptions = (user?.artistAliases ?? []).filter((alias) => alias.trim());
  const defaultArtistLabel = user?.artistAlias?.trim() || user?.name?.trim() || t("releases.unknownArtist");
  const defaultWriterLabel = user?.writerAlias?.trim() || defaultArtistLabel;

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
  const [lyricsSaved, setLyricsSaved] = useState(false);

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
        <h2 className="text-lg font-semibold tracking-tight text-white/90">{t("nav.music")}</h2>
        <button
          type="button"
          onClick={() => setShowClearConfirm(true)}
          className="btn-secondary text-sm px-3 py-1.5"
        >
          {t("studio.clearAll")}
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
          message={t("studio.clearConfirmMessage")}
          cancelLabel={t("common.cancel")}
          confirmLabel={t("studio.clearAllConfirm")}
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
          message={t("studio.vocalGenderConfirmMessage")}
          cancelLabel={t("common.cancel")}
          confirmLabel={t("library.continue")}
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
              <p className="text-sm font-semibold text-white mb-1">{t("studio.noLyricsTitle")}</p>
              <p className="text-sm text-white/65 leading-relaxed">
                {t("studio.noLyricsBody")}
              </p>
            </>
          }
          cancelLabel={t("common.cancel")}
          confirmLabel={t("studio.continueAnyway")}
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
          message={t("studio.styleTooLongMessage", { count: promptCharCount, max: styleMaxChars })}
          cancelLabel={t("studio.adjustMyself")}
          confirmLabel={t("studio.optimize")}
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
            <h3 className="text-sm font-semibold text-white/80">{t("studio.lyrics")}</h3>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${instrumental ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "bg-primary-500/20 text-primary-400 border border-primary-500/30"}`}>
              {instrumental ? t("studio.instrumentalBadge") : t("studio.vocalBadge")}
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
              <span className="sr-only">{t("studio.instrumentalToggleSr")}</span>
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
            {t("studio.heartMulaLyricsHintPrefix")} <span className="text-white/50 font-mono">[Verse]</span>, <span className="text-white/50 font-mono">[Chorus]</span>, <span className="text-white/50 font-mono">[Bridge]</span>{t("studio.heartMulaLyricsHintSuffix")} <span className="text-white/50 font-mono">[intro-short]</span>, <span className="text-white/50 font-mono">[inst-medium]</span>, <span className="text-white/50 font-mono">[outro-short]</span>.
          </p>
        )}
        {(!instrumental || isHeartMulaSelected) && (
          <>
            <div className="relative">
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder={isHeartMulaSelected ? `${t("studio.lyricsPlaceholderHeartMulaIntro")}

[Verse]
${t("studio.yourLyricsHere")}

[Chorus]
${t("studio.yourChorusHere")}

[intro-short]
[outro-short]` : `${t("studio.lyricsPlaceholderDefaultIntro")}

[Verse]
${t("studio.yourLyricsHere")}

[Chorus]
${t("studio.yourChorusHere")}`}
                className="input-field min-h-[220px] resize-y text-base leading-relaxed"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/melody")}
                  className="btn-ghost text-sm flex items-center gap-1.5"
                  title={t("studio.writeGenerateLyricsInMelody")}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t("studio.generateLyrics")}
                </button>
                <button
                  type="button"
                  onClick={() => setLyricsExpanded(true)}
                  className="btn-ghost text-sm flex items-center gap-1.5"
                  title={t("studio.expandLyricsEditor")}
                  aria-label={t("studio.expandLyricsEditor")}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  </svg>
                  {t("studio.expandEditor")}
                </button>
              </div>

              <div className="flex items-center gap-1.5 bg-[#12121a]/85 px-2 py-1 rounded-lg border border-white/5 shadow-md">
                <button
                  type="button"
                  onClick={() => handleCopy(lyrics, "lyrics")}
                  disabled={!lyrics.trim()}
                  className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title={t("studio.copyLyrics")}
                  aria-label={t("studio.copyLyrics")}
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
                  title={t("studio.saveLyrics")}
                  aria-label={t("studio.saveLyrics")}
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
                  title={t("studio.clearLyrics")}
                  aria-label={t("studio.clearLyrics")}
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

            <SavedLyricsList />
          </>
        )}

        {instrumental && !isHeartMulaSelected && (
          <p className="text-sm text-white/30 italic">
            🎵 <span className="text-white/50">{t("studio.instrumentalModeLabel")}</span> {t("studio.instrumentalModeHint")}
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
              <h3 className="text-sm font-semibold text-white/80">{t("studio.lyrics")}</h3>
              <span className={`text-xs text-white/30`}>{lyricsCharCount}/{lyricsMaxChars}</span>
            </div>
            <button
              type="button"
              onClick={() => setLyricsExpanded(false)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition"
              title={t("studio.collapseLyricsEditor")}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
              {t("playlists.close")}
            </button>
          </div>
          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder={isHeartMulaSelected
              ? `${t("studio.lyricsPlaceholderHeartMulaIntro")}\n\n[Verse]\n${t("studio.yourLyricsHere")}\n\n[Chorus]\n${t("studio.yourChorusHere")}\n\n[intro-short]\n[outro-short]`
              : `${t("studio.lyricsPlaceholderDefaultIntro")}\n\n[Verse]\n${t("studio.yourLyricsHere")}\n\n[Chorus]\n${t("studio.yourChorusHere")}`}
            className="flex-1 w-full rounded-xl border border-white/10 bg-white/5 p-4 text-base leading-relaxed text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-primary-500/50 resize-none"
            autoFocus
          />
        </div>
      )}

      {/* Style Section */}
      <section className="section-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white/80">{isHeartMulaSelected ? t("studio.styleTagsHeading") : t("studio.stylePromptHeading")}</h3>
        </div>
        {isHeartMulaSelected && (
          <p className="text-sm text-white/30 italic mb-2">
            {t("studio.styleTagsHint")}
          </p>
        )}

        <div className="relative">
          <textarea
            value={songIdea}
            onChange={(e) => setSongIdea(e.target.value)}
            placeholder={isHeartMulaSelected
              ? t("studio.stylePlaceholderHeartMula")
              : t("studio.stylePlaceholderDefault")}
            className="input-field min-h-[120px] resize-y text-sm leading-relaxed"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/melody")}
              className="btn-ghost text-sm flex items-center gap-1.5"
              title={t("studio.buildStyleInMelody")}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {t("studio.generateStyle")}
            </button>

            <PresetsManager songIdea={songIdea} setSongIdea={setSongIdea} />
          </div>

          <div className="flex items-center gap-1.5 bg-[#12121a]/85 px-2 py-1 rounded-lg border border-white/5 shadow-md">
            <button
              type="button"
              onClick={() => handleCopy(songIdea, "style")}
              disabled={!songIdea.trim()}
              className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title={t("studio.copyStyle")}
              aria-label={t("studio.copyStyle")}
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
              title={t("studio.clearStyle")}
              aria-label={t("studio.clearStyle")}
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

        {/* PoYo Sliders — only for PoYo provider */}
        {Object.keys(selectedProviders).length > 0 && Object.keys(selectedProviders)[0] === "poyo" && (
          <>
            <div className="my-4 h-px bg-white/10" />

            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white/60 uppercase tracking-wider">{t("studio.slidersHeading")}</h4>
              <button
                type="button"
                onClick={() => setShowProTips(!showProTips)}
                className="flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300 transition-colors"
              >
                <svg className={`w-3 h-3 transition-transform duration-200 ${showProTips ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {t("studio.proTips")}
              </button>
            </div>

            {showProTips && (
              <div className="mb-4 p-3 rounded-lg bg-primary-500/5 border border-primary-500/20 space-y-2">
                <p className="text-sm text-primary-300 font-medium">{t("studio.proTipsHeading")}</p>
                <ul className="text-sm text-white/40 space-y-1.5 list-disc list-inside">
                  <li><span className="text-white/60">{t("studio.proTip1Label")}</span> {t("studio.proTip1Text")}</li>
                  <li><span className="text-white/60">{t("studio.proTip2Label")}</span> {t("studio.proTip2Text")}</li>
                  <li><span className="text-white/60">{t("studio.proTip3Label")}</span> {t("studio.proTip3Text")}</li>
                </ul>
              </div>
            )}

            {/* Weirdness Slider */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-white/60">{t("studio.weirdnessLabel")}</label>
                <span className="text-sm text-white/40 font-mono">{weirdness}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/25 uppercase tracking-wider">{t("studio.safeLabel")}</span>
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
                <span className="text-[10px] text-white/25 uppercase tracking-wider">{t("studio.chaosLabel")}</span>
              </div>
              <p className="text-[10px] text-white/25 mt-1">
                {weirdness <= 20 ? t("studio.weirdnessDescLow") : weirdness <= 60 ? t("studio.weirdnessDescMid") : t("studio.weirdnessDescHigh")}
              </p>
            </div>

            {/* Style Influence Slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-white/60">{t("studio.styleInfluenceLabel")}</label>
                <span className="text-sm text-white/40 font-mono">{styleInfluence}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/25 uppercase tracking-wider">{t("studio.looseLabel")}</span>
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
                <span className="text-[10px] text-white/25 uppercase tracking-wider">{t("studio.strongLabel")}</span>
              </div>
              <p className="text-[10px] text-white/25 mt-1">
                {styleInfluence <= 40 ? t("studio.styleInfluenceDescLow") : styleInfluence <= 70 ? t("studio.styleInfluenceDescMid") : t("studio.styleInfluenceDescHigh")}
              </p>
            </div>
          </>
        )}

        {/* APIMart Sliders — only for APIMart provider */}
        {Object.keys(selectedProviders).length > 0 && Object.keys(selectedProviders)[0] === "apimart" && (
          <>
            <div className="my-4 h-px bg-white/10" />

            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white/60 uppercase tracking-wider">{t("studio.apiMartSettingsHeading")}</h4>
            </div>

            {/* Exclude Styles (Negative Tags) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-white/60 mb-1.5">{t("studio.excludeStylesLabel")}</label>
              <input
                type="text"
                placeholder={t("studio.excludeStylesPlaceholder")}
                value={negativeTags}
                onChange={(e) => setNegativeTags(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
              />
            </div>

            {/* Style Weight */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-white/60">{t("studio.styleWeightLabel")}</label>
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
              <p className="text-[10px] text-white/25 mt-1">{t("studio.customTrueHint")}</p>
            </div>

            {/* Weirdness Constraint (Creativity) */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-white/60">{t("studio.creativityWeirdnessLabel")}</label>
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
              <p className="text-[10px] text-white/25 mt-1">{t("studio.customTrueHint")}</p>
            </div>

            {/* Audio Weight — only relevant when a cloned/uploaded voice is used */}
            {usePersonaVoice && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-white/60">{t("studio.audioWeightLabel")}</label>
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
                <p className="text-[10px] text-white/25 mt-1">{t("studio.customTrueHint")}</p>
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
          <h3 className="text-sm font-semibold text-white/80 mb-3">{t("studio.vocalGenderHeading")}</h3>
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
              👩‍🎤 {t("studio.femaleOption")}
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
              👨‍🎤 {t("studio.maleOption")}
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

      {/* Credits Section */}
      <section className="section-card">
        <h3 className="text-sm font-semibold text-white/80 mb-3">{t("studio.creditsHeading")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-white/50 mb-1">{t("studio.artistLabel")}</label>
            {artistAliasOptions.length > 0 ? (
              <select
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                className="input-field text-sm py-1.5"
              >
                <option value="">{t("releases.defaultArtist", { name: defaultArtistLabel })}</option>
                {artistAliasOptions.map((alias) => (
                  <option key={alias} value={alias}>
                    {alias}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder={t("releases.defaultArtist", { name: defaultArtistLabel })}
                className="input-field text-sm py-1.5"
                maxLength={255}
              />
            )}
          </div>
          <div>
            <label className="block text-[10px] text-white/50 mb-1">{t("studio.writerLabel")}</label>
            <input
              type="text"
              value={writerName}
              onChange={(e) => setWriterName(e.target.value)}
              placeholder={t("releases.defaultArtist", { name: defaultWriterLabel })}
              className="input-field text-sm py-1.5"
              maxLength={255}
            />
          </div>
        </div>
      </section>
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
            {t("studio.autoCreateWorkspaceLabel")}
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
          label={t("studio.generateTrackButton")}
          loadingLabel={t("studio.generating")}
          className="w-full py-3 text-sm tracking-wide"
        />

        {/* Validation hint when button is disabled */}
        {!canGenerate && (
          <p className="text-center text-sm text-red-400/60">
            {Object.keys(selectedProviders).length === 0
              ? t("studio.selectProviderHint")
              : t("studio.describeStyleHint")}
          </p>
        )}
      </div>
    </div>
  );
});
