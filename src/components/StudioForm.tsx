"use client";

import { memo, useEffect, useState } from "react";
import GenerateButton from "@/components/studio/GenerateButton";
import { useStudioStore, usePresetsStore } from "@/lib/store";

const PROVIDERS = {
  lyria: { name: "Lyria", fullName: "Google Lyria 3", models: ["lyria-3-pro-preview", "lyria-3-clip-preview"], icon: "G" },
  poyo: { name: "PoYo", fullName: "PoYo (Suno)", models: ["v5.5", "v5", "v4.5", "v4", "minimax-music-2.6"], icon: "P" },
  tempolor: { name: "Tempolor", fullName: "Tempolor", models: ["TemPolor v4.6", "TemPolor v3.5", "TemPolor v3", "TemPolor i3.5", "TemPolor i3"], icon: "T" },
  musicgpt: { name: "MusicGPT", fullName: "MusicGPT v6", models: ["v6"], icon: "M" },
  minimax: { name: "Minimax", fullName: "MiniMax Music 2.6", models: ["music-2.6"], icon: "X" },
  mureka: { name: "Mureka", fullName: "Mureka V9 (WaveSpeed)", models: ["mureka-v9"], icon: "W" },
};

const STYLE_TAG_GROUPS: { label: string; tags: string[] }[] = [
  {
    label: "Electronic",
    tags: [
      "House",
      "Deep House",
      "Tech House",
      "Techno",
      "Minimal Techno",
      "Drum & Bass",
      "Jungle",
      "Trance",
      "Progressive Trance",
      "Psytrance",
      "Synthwave",
      "Retrowave",
      "Vaporwave",
      "IDM",
      "Breakbeat",
      "UK Garage",
      "2-Step",
      "Dubstep",
      "Future Bass",
      "Electro",
    ],
  },
  {
    label: "Urban & World",
    tags: [
      "Hip-Hop",
      "Boom Bap",
      "Trap",
      "Drill",
      "R&B",
      "Neo Soul",
      "Afrobeats",
      "Amapiano",
      "Dancehall",
      "Reggaeton",
      "Latin Pop",
      "Baile Funk",
      "Gqom",
      "Kuduro",
      "Afro House",
    ],
  },
  {
    label: "Band & Organic",
    tags: [
      "Indie Pop",
      "Dream Pop",
      "Shoegaze",
      "Indie Rock",
      "Post-Rock",
      "Folk",
      "Acoustic",
      "Singer-Songwriter",
      "Country",
      "Bluegrass",
      "Jazz",
      "Nu Jazz",
      "Blues",
      "Gospel",
      "Soul",
    ],
  },
  {
    label: "Cinematic & Classical",
    tags: [
      "Orchestral",
      "Cinematic",
      "Chamber Music",
      "Baroque",
      "Minimalist Classical",
    ],
  },
  {
    label: "Ambient & Texture",
    tags: [
      "Ambient",
      "Dark Ambient",
      "Drone",
      "Soundscape",
      "Granular",
      "Noise",
      "Glitch",
      "Microsound",
      "Field Recording",
      "Lo-Fi",
    ],
  },
  {
    label: "Drums & Rhythm",
    tags: [
      "808 Bass",
      "Boom Bap Drums",
      "Live Drums",
      "Drum Machine",
      "Half-Time",
      "Breakbeat",
      "Polyrhythmic",
      "Swing",
      "Trap Hi-Hats",
      "Brushed Snare",
    ],
  },
  {
    label: "Bass & Low End",
    tags: [
      "Sub Bass",
      "Reese Bass",
      "Wobble Bass",
      "Sidechain Compression",
      "Pumping Bass",
      "Walking Bassline",
      "Fretless Bass",
      "Synth Bass",
    ],
  },
  {
    label: "Synths & Keys",
    tags: [
      "Analog Synth",
      "FM Synthesis",
      "Wavetable",
      "Pad Chords",
      "Layered Pads",
      "Arpeggiated Synth",
      "Rhodes Piano",
      "Prepared Piano",
      "Wurlitzer",
      "Mellotron",
    ],
  },
  {
    label: "Guitar & Strings",
    tags: [
      "Fingerpicked Guitar",
      "Slide Guitar",
      "Tremolo Guitar",
      "Plucked Strings",
      "String Quartet",
      "Pizzicato",
      "Electric Guitar",
      "Nylon Guitar",
    ],
  },
  {
    label: "FX & Processing",
    tags: [
      "Vinyl Crackle",
      "Tape Hiss",
      "Reverse Reverb",
      "Pitch Shift",
      "Vocal Chops",
      "FX Risers",
      "White Noise Sweeps",
      "Bitcrusher",
      "Saturated",
      "Distorted",
      "Glitchy",
    ],
  },
  {
    label: "Mood & Energy",
    tags: [
      "Melancholic",
      "Euphoric",
      "Brooding",
      "Nostalgic",
      "Hypnotic",
      "Eerie",
      "Uplifting",
      "Tense",
      "Dreamy",
      "Aggressive",
      "Romantic",
      "Sparse",
      "Lush",
      "Intimate",
      "Raw",
    ],
  },
  {
    label: "Vocal Style",
    tags: [
      "Close-Mic Vocals",
      "Dry Vocals",
      "Layered Harmonies",
      "Falsetto",
      "Whispered",
      "Spoken Word",
      "No Vocals",
    ],
  },
];

export default memo(function StudioForm({
  credits,
  isGenerating,
  onGenerate,
  onOptimize,
  onGenerateLyrics,
  onGenerateTitle,
}: {
  credits: { lyria: string | number; poyo: number | null; tempolor: number | null };
  isGenerating: boolean;
  onGenerate: () => void;
  onOptimize: () => void;
  onGenerateLyrics: () => void;
  onGenerateTitle: (lyrics: string) => Promise<string | null>;
}) {
  const {
    songIdea,
    lyrics,
    lyricsContext,
    title,
    autoCreateWorkspaceFromGeneratedTitle,
    selectedProviders,
    instrumental,
    vocalGender,
    weirdness,
    styleInfluence,
    setSongIdea,
    setLyrics,
    setLyricsContext,
    setTitle,
    setAutoCreateWorkspaceFromGeneratedTitle,
    setProvider,
    toggleProvider,
    setProviderModel,
    setInstrumental,
    setVocalGender,
    setWeirdness,
    setStyleInfluence,
    reset,
  } = useStudioStore();

  const [optimizing, setOptimizing] = useState(false);
  const [generatingLyrics, setGeneratingLyrics] = useState(false);
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showProTips, setShowProTips] = useState(false);
  const [copiedField, setCopiedField] = useState<"lyrics" | "style" | null>(null);
  const [lyricsExpanded, setLyricsExpanded] = useState(false);

  // Saved presets store hooks and local UI states
  const presets = usePresetsStore((state) => state.presets);
  const addPreset = usePresetsStore((state) => state.addPreset);
  const deletePreset = usePresetsStore((state) => state.deletePreset);
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

  const promptCharCount = songIdea.length;
  const styleMaxChars = 1000;
  const lyricsCharCount = lyrics.length;
  const lyricsMaxChars = 3000;
  const titleCharCount = title.length;
  const titleMaxChars = 120;

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

  async function handleGenerateLyrics() {
    if (!songIdea) return;
    setGeneratingLyrics(true);
    try {
      await onGenerateLyrics();
      setShowLyrics(true);
    } finally {
      setGeneratingLyrics(false);
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

  function addStyleTag(tag: string) {
    const currentStyle = songIdea.trim();
    const tagText = tag.toLowerCase();
    if (currentStyle && !currentStyle.toLowerCase().includes(tagText)) {
      setSongIdea(currentStyle + ", " + tag);
    } else if (!currentStyle) {
      setSongIdea(tag);
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
        <h2 className="text-lg font-semibold tracking-tight text-white/90">Studio</h2>
        <button
          type="button"
          onClick={reset}
          className="btn-secondary text-xs px-3 py-1.5"
        >
          Clear All
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-4 pr-1">

      {/* Provider & Model Section */}
      <section className="section-card lg:sticky lg:top-0 lg:z-20 lg:bg-[#0a0a0f]/98 lg:backdrop-blur-sm lg:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <h3 className="text-sm font-semibold text-white/80 mb-3">Provider & Model</h3>
        <div className="flex gap-2">
          <select
            value={Object.keys(selectedProviders)[0] || ""}
            onChange={(e) => {
              const key = e.target.value;
              if (key) {
                setProvider(key, PROVIDERS[key as keyof typeof PROVIDERS].models[0]);
              }
            }}
            aria-label="Select provider"
            className="select-field text-sm flex-1"
          >
            <option value="" className="bg-gray-900">Select provider...</option>
            {Object.entries(PROVIDERS).map(([key, val]) => (
              <option key={key} value={key} className="bg-gray-900">
                {val.fullName}
              </option>
            ))}
          </select>
          {Object.keys(selectedProviders).length > 0 && (
            <select
              value={selectedProviders[Object.keys(selectedProviders)[0]]}
              onChange={(e) => setProviderModel(Object.keys(selectedProviders)[0], e.target.value)}
              aria-label="Select model"
              className="select-field text-sm flex-1"
            >
              {PROVIDERS[Object.keys(selectedProviders)[0] as keyof typeof PROVIDERS]?.models.map((model) => (
                <option key={model} value={model} className="bg-gray-900">
                  {model}
                </option>
              ))}
            </select>
          )}
        </div>
        {Object.keys(selectedProviders).length > 0 && (
          <div className="mt-2 text-xs text-white/30">
            {(() => {
              const key = Object.keys(selectedProviders)[0];
              const currentCredits = credits[key as keyof typeof credits];
              return key === "lyria" ? "Pay-per-use" : currentCredits !== null && currentCredits !== undefined ? `${currentCredits} credits` : "Not configured";
            })()}
          </div>
        )}
      </section>

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
            {!instrumental && (
              <button
                type="button"
                onClick={() => setLyricsExpanded(true)}
                className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                title="Expand lyrics editor"
                aria-label="Expand lyrics editor"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                </svg>
              </button>
            )}
            {!instrumental && (
              <button
                type="button"
                onClick={() => handleCopy(lyrics, "lyrics")}
                disabled={!lyrics.trim()}
                className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Copy lyrics"
                aria-label="Copy lyrics"
              >
                {copiedField === "lyrics" ? (
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            )}
            {!instrumental && (
              <button
                type="button"
                onClick={() => setLyrics("")}
                disabled={!lyrics.trim()}
                className="text-white/30 hover:text-white/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Clear lyrics"
                aria-label="Clear lyrics"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
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

        {!instrumental && (
          <>
            <div className="mb-3">
              <label className="block text-xs text-white/50 mb-1.5">Lyrics Topic & Mood</label>
              <input
                type="text"
                value={lyricsContext}
                onChange={(e) => setLyricsContext(e.target.value)}
                placeholder="e.g. heartbreak, melancholic OR freedom, uplifting"
                className="input-field text-sm"
              />
            </div>
            <div className="relative">
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder={`Write your lyrics here...

[Verse]
Your lyrics here

[Chorus]
Your chorus here`}
                className="input-field min-h-[220px] resize-y font-mono text-sm leading-relaxed pb-6"
              />
              <span className={`absolute bottom-2 right-3 text-xs pointer-events-none ${
                lyricsCharCount >= lyricsMaxChars ? "text-red-400" : "text-white/20"
              }`}>
                {lyricsCharCount}/{lyricsMaxChars}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleGenerateLyrics}
                disabled={!lyricsContext || generatingLyrics}
                className="btn-ghost text-xs flex items-center gap-1.5"
              >
                {generatingLyrics ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                {generatingLyrics ? "Generating..." : "Generate Lyrics"}
              </button>
            </div>
          </>
        )}

        {instrumental && (
          <p className="text-xs text-white/30 italic">
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
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition"
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
            placeholder={`Write your lyrics here...\n\n[Verse]\nYour lyrics here\n\n[Chorus]\nYour chorus here`}
            className="flex-1 w-full rounded-xl border border-white/10 bg-white/5 p-4 font-mono text-sm leading-relaxed text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-primary-500/50 resize-none"
            autoFocus
          />
        </div>
      )}

      {/* Style Section */}
      <section className="section-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white/80">Style & Prompt</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopy(songIdea, "style")}
              disabled={!songIdea.trim()}
              className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Copy style"
              aria-label="Copy style"
            >
              {copiedField === "style" ? (
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => setSongIdea("")}
              className="text-white/30 hover:text-white/60 transition-colors"
              title="Clear"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={songIdea}
            onChange={(e) => setSongIdea(e.target.value)}
            placeholder={`Describe your song style... e.g. "Dark Dutch Folk, subdued introspective, piano with sparse arrangement"`}
            className="input-field min-h-[120px] resize-y text-sm leading-relaxed pb-6"
          />
          <span
            className={`absolute bottom-2 right-3 text-xs pointer-events-none ${
              promptCharCount >= styleMaxChars ? "text-red-400" : "text-white/20"
            }`}
          >
            {promptCharCount}/{styleMaxChars}
          </span>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowTags(!showTags)}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform duration-200 ${showTags ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showTags ? "Hide style tags" : "Browse style tags"}
          </button>

          {showTags && (
            <div className="mt-3 max-h-64 overflow-y-auto pr-1 space-y-3">
              {STYLE_TAG_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/25 mb-1.5">
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => addStyleTag(tag)}
                        className="px-2.5 py-1 text-xs rounded-full bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70 hover:border-white/20 transition-colors"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            onClick={handleOptimize}
            disabled={!songIdea || optimizing}
            className="btn-ghost text-xs flex items-center gap-1.5"
          >
            {optimizing ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
            {optimizing ? "Generating..." : "Generate Style"}
          </button>

          <button
            type="button"
            disabled={!songIdea.trim()}
            onClick={() => {
              setShowSavePresetForm(!showSavePresetForm);
              setPresetName("");
              setPresetNotes("");
            }}
            className="btn-secondary text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
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
              className={`btn-ghost text-xs flex items-center gap-1.5 ${showSavedPresetsList ? "text-primary-300 font-semibold" : "text-white/60 hover:text-white"}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              My Presets ({presets.length})
            </button>
          )}
        </div>

        {/* Save Preset Form */}
        {showSavePresetForm && (
          <div className="mt-4 p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
            <p className="text-xs font-semibold text-primary-300">Save Style & Prompt Preset</p>
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] text-white/50 mb-1">Preset Name</label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g. Dutch Melancholy, Summer Uplifting"
                  className="input-field text-xs py-1.5 focus:border-primary-500/50 outline-none"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-[10px] text-white/50 mb-1">Notes about this prompt</label>
                <textarea
                  value={presetNotes}
                  onChange={(e) => setPresetNotes(e.target.value)}
                  placeholder="Notes down specific ideas, instruments, or details..."
                  className="input-field text-xs py-1.5 min-h-[60px] resize-y focus:border-primary-500/50 outline-none"
                  maxLength={500}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowSavePresetForm(false)}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!presetName.trim()}
                onClick={() => {
                  addPreset(presetName, songIdea, presetNotes);
                  setShowSavePresetForm(false);
                  setShowSavedPresetsList(true);
                  setPresetName("");
                  setPresetNotes("");
                }}
                className="px-3 py-1.5 rounded-lg bg-primary-500/80 hover:bg-primary-500 text-xs text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              <p className="text-xs font-semibold text-white/60">My Saved Presets</p>
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
                        <p className="text-xs font-semibold text-white/95 truncate">{preset.name}</p>
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
                          onClick={() => deletePreset(preset.id)}
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
              <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Sliders</h4>
              <button
                type="button"
                onClick={() => setShowProTips(!showProTips)}
                className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
              >
                <svg className={`w-3 h-3 transition-transform duration-200 ${showProTips ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Pro Tips
              </button>
            </div>

            {showProTips && (
              <div className="mb-4 p-3 rounded-lg bg-primary-500/5 border border-primary-500/20 space-y-2">
                <p className="text-xs text-primary-300 font-medium">Pro Tips for Best Results</p>
                <ul className="text-xs text-white/40 space-y-1.5 list-disc list-inside">
                  <li><span className="text-white/60">Tweak One at a Time:</span> Altering all sliders at once makes it hard to trace what caused a specific output.</li>
                  <li><span className="text-white/60">Detailed Prompts Need Lower Weirdness:</span> Keep Weirdness below 40% with hyper-specific prompts to avoid the AI tripping over itself.</li>
                  <li><span className="text-white/60">Vocal Glitches:</span> If your singer stumbles or hallucinates lyrics, drop Weirdness and Style Influence down to correct the flow.</li>
                </ul>
              </div>
            )}

            {/* Weirdness Slider */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-white/60">Weirdness</label>
                <span className="text-xs text-white/40 font-mono">{weirdness}%</span>
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
                <label className="text-xs font-medium text-white/60">Style Influence</label>
                <span className="text-xs text-white/40 font-mono">{styleInfluence}%</span>
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
      </section>

      {!instrumental && (
        <section className="section-card">
          <h3 className="text-sm font-semibold text-white/80 mb-3">Vocal Gender</h3>
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            <button
              type="button"
              onClick={() => setVocalGender(vocalGender === "female" ? "auto" : "female")}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                vocalGender === "female"
                  ? "bg-pink-500/30 text-pink-300"
                  : "bg-white/5 text-white/40 hover:bg-white/10"
              }`}
            >
              🎤 Female
            </button>
            <button
              type="button"
              onClick={() => setVocalGender(vocalGender === "male" ? "auto" : "male")}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                vocalGender === "male"
                  ? "bg-blue-500/30 text-blue-300"
                  : "bg-white/5 text-white/40 hover:bg-white/10"
              }`}
            >
              🎤 Male
            </button>
          </div>
        </section>
      )}

      {/* Title Section */}
      <section className="section-card">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-semibold text-white/80">Song Title</label>
          {!instrumental && !title.trim() && lyrics.trim() && (
            <button
              onClick={handleGenerateTitle}
              disabled={generatingTitle || !lyrics.trim()}
              className="btn-ghost text-xs flex items-center gap-1.5"
            >
              {generatingTitle ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              {generatingTitle ? "Generating..." : "🤖 Generate Title"}
            </button>
          )}
        </div>
        <div className="relative">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your track a name..."
            className="input-field text-sm pr-16"
            maxLength={titleMaxChars}
          />
          <span className={`absolute bottom-3 right-3 text-xs ${titleCharCount > titleMaxChars * 0.9 ? "text-red-400" : "text-white/20"}`}>
            {titleCharCount}/{titleMaxChars}
          </span>
        </div>
        {!title.trim() && (
          <p className="text-xs text-white/40 mt-1">
            Title is optional. Leave empty if you want.
          </p>
        )}
      </section>
      </div>

      {/* Generate Button */}
      <div className="sticky bottom-0 z-10 space-y-2 rounded-xl border border-white/10 bg-[#11111a]/95 p-3 backdrop-blur-sm">
        <label className="flex items-start gap-2.5 text-xs text-white/70">
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
          onClick={onGenerate}
          loading={isGenerating}
          disabled={!canGenerate}
          label="🎶 Generate Track"
          loadingLabel="Generating..."
          className="w-full py-3 text-sm tracking-wide"
        />

        {/* Validation hint when button is disabled */}
        {!canGenerate && (
          <p className="text-center text-xs text-red-400/60">
            {Object.keys(selectedProviders).length === 0
              ? "Select at least one provider"
              : "Describe a style or prompt to continue"}
          </p>
        )}
      </div>
    </div>
  );
});