"use client";

import { useState } from "react";
import { useStudioStore } from "@/lib/store";

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Japanese",
  "Korean",
  "Hindi",
  "Portuguese",
  "Italian",
  "Mandarin",
  "Dutch",
  "Other...",
];

const PROVIDERS = {
  lyria: { name: "Lyria", fullName: "Google Lyria 3", models: ["lyria-3"], icon: "G" },
  poyo: { name: "PoYo", fullName: "PoYo (Suno)", models: ["v4", "v5.5"], icon: "P" },
  tempolor: { name: "Tempolor", fullName: "Tempolor", models: ["v3", "v4.6", "i3", "i3.5"], icon: "T" },
};

const STYLE_TAGS = ["FX Risers", "Epic", "Amapiano", "Soul", "Lo-Fi", "Orchestral", "Synthwave", "Acoustic"];

const STRUCTURES = [
  { label: "Eenvoudige pop-variaties", group: true },
  { value: "abab", label: "ABAB", desc: "Vers – Refrein – Vers – Refrein. Simpel, radio-vriendelijk." },
  { value: "ababc", label: "ABABC", desc: "Vers – Refrein – Vers – Refrein – Brug/Outro. Extra ruimte voor finale." },
  { value: "ababcbc", label: "ABABCBC", desc: "Extra herhaling van B/C voor dramatische build-up. Festival-stijl." },
  { value: "aaa", label: "AAA (alleen couplet)", desc: "Alles is tekst-vers, muziek herhaalt zich. Volksliedjes, ballads." },
  { value: "aaba", label: "AABA (klassieke 32-bar)", desc: "A-vers – A-vers – B-brug – A-vers. Jazz, ballads, cine-muziek." },
  { label: "Dance / TCH-stijl", group: true },
  { value: "dance-2drops", label: "Intro → Verse → Build → Drop → Verse → Build → Drop → Outro", desc: "Klassieke 2-drops-structuur. House/techno." },
  { value: "dance-breaks", label: "Intro → Break → Build → Drop → Break → Build → Drop → Outro", desc: "Twee break-build-drop-blokken. Ideaal voor clubs." },
  { value: "dance-earlydrop", label: "Intro → Verse → Drop → Verse → Break → Build → Drop → Outro", desc: "Direct in de drop. Festival/peak-hour." },
  { value: "one-drop", label: "One-drop / minimal", desc: "Intro → Break → Build → Drop → Outro. Focus op textuur." },
  { label: "Singer-songwriter pop", group: true },
  { value: "pop-classic", label: "Intro → Verse → Chorus → Verse → Chorus → Bridge → Chorus → Outro", desc: "Klassieke pop-structuur (ABABCB). Radio-ready." },
  { value: "pop-finallift", label: "Intro → Verse → Chorus → Bridge → Chorus → Final lift", desc: "Extra brug + lift (strip-down + build-up)." },
  { value: "pop-prechorus", label: "Intro → Verse → Chorus → Pre-Chorus → Chorus → Bridge → Outro", desc: "Pre-chorus voegt spanning toe. Dramatische pop." },
  { value: "pop-triplechorus", label: "Intro → Verse → Chorus → Verse → Chorus → Chorus → Outro", desc: "Drie keer refrein voor sticky effect." },
  { value: "pop-instrumental", label: "Intro → Verse → Chorus → Bridge → Instrumental → Chorus → Outro", desc: "Instrumentale highlight na de brug. Solo/pads." },
  { value: "ai-choose", label: "Kies jij maar", desc: "AI kiest de beste structuur." },
  { value: "manual", label: "Handmatig", desc: "Typ je eigen structuur." },
];

export default function StudioForm({
  credits,
  onGenerate,
  onOptimize,
  onGenerateLyrics,
  onGenerateTitle,
}: {
  credits: { lyria: string | number; poyo: number | null; tempolor: number | null };
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
    provider,
    providerModel,
    language,
    customLanguage,
    instrumental,
    vocalGender,
    structure,
    customStructure,
    setSongIdea,
    setLyrics,
    setLyricsContext,
    setTitle,
    setProvider,
    setProviderModel,
    setLanguage,
    setCustomLanguage,
    setInstrumental,
    setVocalGender,
    setStructure,
    setCustomStructure,
  } = useStudioStore();

  const [optimizing, setOptimizing] = useState(false);
  const [generatingLyrics, setGeneratingLyrics] = useState(false);
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showStructureDropdown, setShowStructureDropdown] = useState(false);

  const promptCharCount = songIdea.length;
  const promptMaxChars = 2000;
  const titleCharCount = title.length;
  const titleMaxChars = 120;
  const currentProvider = PROVIDERS[provider as keyof typeof PROVIDERS];

  // Generate button logic:
  // - If instrumental OFF: needs lyrics AND style/prompt
  // - If instrumental ON: needs title (prompt is optional since no vocals)
  const canGenerate = instrumental
    ? !!title.trim()
    : !!lyrics.trim() && !!songIdea.trim();

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

  return (
    <div className="space-y-5">
      {/* Structure Section */}
      <section className="section-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white/80">Structure</h3>
          {structure && (
            <button
              onClick={() => { setStructure(""); setCustomStructure(""); }}
              className="text-white/30 hover:text-white/60 transition-colors"
              title="Clear"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
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
              {structure === "ai-choose" ? "Kies jij maar"
                : structure === "manual" ? "Handmatig"
                : structure ? STRUCTURES.find(s => s.value === structure)?.label || "Select..."
                : "Select song structure..."}
            </span>
            <svg className={`w-4 h-4 transition-transform ${showStructureDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showStructureDropdown && (
            <div className="absolute z-50 mt-1 w-full bg-[#1a1a24] border border-white/10 rounded-lg shadow-xl overflow-hidden max-h-72 overflow-y-auto">
              {STRUCTURES.map((item, idx) => {
                if (item.group) {
                  return (
                    <div key={idx} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30 bg-white/5">
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
            onChange={(e) => setCustomStructure(e.target.value)}
            placeholder="Describe your custom song structure... e.g. Intro → Verse → Chorus → Solo → Outro"
            className="input-field min-h-[80px] resize-y text-sm mt-3"
          />
        )}

        {structure === "ai-choose" && (
          <p className="text-xs text-white/30 mt-2">
            AI kiest de beste structuur op basis van je prompt en lyrics
          </p>
        )}

        {structure && structure !== "ai-choose" && structure !== "manual" && (
          <p className="text-xs text-white/30 mt-2">
            {STRUCTURES.find(s => s.value === structure)?.desc}
          </p>
        )}
      </section>

      {/* Lyrics Section */}
      <section className="section-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white/80">Lyrics</h3>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${instrumental ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-300"}`}>
              {instrumental ? "INSTRUMENTAL" : "VOCAL"}
            </span>
          </div>
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
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder={`Write your lyrics here...

[Verse]
Your lyrics here

[Chorus]
Your chorus here`}
              className="input-field min-h-[140px] resize-y font-mono text-sm leading-relaxed"
            />
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

      {/* Style Section */}
      <section className="section-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white/80">Style & Prompt</h3>
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

        <div className="relative">
          <textarea
            value={songIdea}
            onChange={(e) => setSongIdea(e.target.value)}
            placeholder={`Describe your song style... e.g. "Dark Dutch Folk, subdued introspective, piano with sparse arrangement"`}
            className="input-field min-h-[100px] resize-y text-sm leading-relaxed pr-16"
            maxLength={promptMaxChars}
          />
          <span
            className={`absolute bottom-3 right-3 text-xs ${
              promptCharCount > promptMaxChars * 0.9 ? "text-red-400" : "text-white/20"
            }`}
          >
            {promptCharCount}/{promptMaxChars}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {STYLE_TAGS.map((tag) => (
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

        <div className="flex items-center gap-2 mt-3">
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
        </div>
      </section>

      {/* Settings Row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Provider */}
        <section className="section-card">
          <h3 className="text-sm font-semibold text-white/80 mb-3">Provider</h3>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowProviderDropdown(!showProviderDropdown)}
              className="w-full input-field text-left text-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs font-bold">
                  {currentProvider?.icon}
                </span>
                <span>{currentProvider?.fullName || "Select..."}</span>
              </div>
              <svg className={`w-4 h-4 transition-transform ${showProviderDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showProviderDropdown && (
              <div className="absolute z-50 mt-1 w-full bg-[#1a1a24] border border-white/10 rounded-lg shadow-xl overflow-hidden">
                {Object.entries(PROVIDERS).map(([key, val]) => {
                  const currentCredits = credits[key as keyof typeof credits];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setProvider(key);
                        setProviderModel(val.models[0]);
                        setShowProviderDropdown(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        provider === key
                          ? "bg-primary-500/10 text-white"
                          : "text-white/60 hover:bg-white/5"
                      }`}
                    >
                      <span className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs font-bold">
                        {val.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{val.fullName}</p>
                        <p className="text-xs text-white/30">
                          {key === "lyria" ? "Pay-per-use" : currentCredits !== null ? `${currentCredits} credits` : "Not configured"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Model */}
          <select
            value={providerModel}
            onChange={(e) => setProviderModel(e.target.value)}
            className="select-field text-sm mt-2"
          >
            {currentProvider?.models.map((model) => (
              <option key={model} value={model} className="bg-gray-900">
                {model}
              </option>
            ))}
          </select>
        </section>

        {/* Language & Vocal Gender */}
        <section className="section-card">
          <h3 className="text-sm font-semibold text-white/80 mb-3">Language</h3>
          <select
            value={language === "Other..." ? customLanguage : language}
            onChange={(e) => {
              if (e.target.value === "Other...") {
                setLanguage("Other...");
              } else {
                setLanguage(e.target.value);
              }
            }}
            className="select-field text-sm mb-3"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang} className="bg-gray-900">
                {lang}
              </option>
            ))}
          </select>

          {!instrumental && (
            <>
              <h3 className="text-sm font-semibold text-white/80 mb-3">Vocal Gender</h3>
              <div className="flex rounded-lg overflow-hidden border border-white/10">
                <button
                  type="button"
                  onClick={() => setVocalGender("female")}
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
                  onClick={() => setVocalGender("male")}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    vocalGender === "male"
                      ? "bg-blue-500/30 text-blue-300"
                      : "bg-white/5 text-white/40 hover:bg-white/10"
                  }`}
                >
                  🎤 Male
                </button>
              </div>
            </>
          )}
        </section>
      </div>

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
        {!instrumental && !title.trim() && (
          <p className="text-xs text-red-400/60 mt-1">
            ⚠ Title is required for vocal tracks
          </p>
        )}
        {instrumental && (
          <p className="text-xs text-white/30 mt-1">
            💡 Tip: A descriptive title helps with search and organization
          </p>
        )}
      </section>

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={!canGenerate}
        className="w-full btn-primary py-3 text-sm font-semibold tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
      >
        🎶 Generate Track
      </button>

      {/* Validation hint when button is disabled */}
      {!canGenerate && (
        <p className="text-center text-xs text-red-400/60">
          {instrumental
            ? "Set a title to generate"
            : !lyrics.trim()
            ? "Write or generate lyrics to continue"
            : "Describe a style or prompt to continue"}
        </p>
      )}
    </div>
  );
}