"use client";

import { useState, useEffect } from "react";
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
  lyria: { name: "Google Lyria 3", models: ["lyria-3"], icon: "G" },
  poyo: { name: "PoYo (Suno)", models: ["v4", "v5.5"], icon: "P" },
  tempolor: {
    name: "Tempolor",
    models: ["v3", "v4.6", "i3", "i3.5"],
    icon: "T",
  },
};

export default function StudioForm({
  credits,
  onGenerate,
  onOptimize,
  onGenerateLyrics,
}: {
  credits: { lyria: string | number; poyo: number | null; tempolor: number | null };
  onGenerate: () => void;
  onOptimize: () => void;
  onGenerateLyrics: () => void;
}) {
  const {
    songIdea,
    lyrics,
    title,
    provider,
    providerModel,
    language,
    customLanguage,
    instrumental,
    setSongIdea,
    setLyrics,
    setTitle,
    setProvider,
    setProviderModel,
    setLanguage,
    setCustomLanguage,
    setInstrumental,
  } = useStudioStore();

  const [optimizing, setOptimizing] = useState(false);
  const [generatingLyrics, setGeneratingLyrics] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);

  const charCount = songIdea.length;
  const maxChars = 1000;
  const currentCredits = credits[provider as keyof typeof credits];

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

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">
          Song Idea & Style
        </label>
        <div className="relative">
          <textarea
            value={songIdea}
            onChange={(e) => setSongIdea(e.target.value)}
            placeholder="Describe your song idea... e.g. 'A dreamy indie pop song about late night drives through the city, feeling nostalgic but hopeful'"
            className="input-field min-h-[120px] resize-y pr-16"
            maxLength={maxChars}
          />
          <span
            className={`absolute bottom-3 right-3 text-xs ${
              charCount > maxChars * 0.9
                ? "text-red-400"
                : "text-white/30"
            }`}
          >
            {charCount}/{maxChars}
          </span>
        </div>
        <button
          onClick={handleOptimize}
          disabled={!songIdea || optimizing}
          className="mt-2 btn-secondary text-sm flex items-center gap-2"
        >
          {optimizing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Optimizing...
            </>
          ) : (
            <>✨ AI Optimize</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Provider</label>
          <div className="space-y-2">
            {Object.entries(PROVIDERS).map(([key, val]) => (
              <button
                key={key}
                onClick={() => {
                  setProvider(key);
                  setProviderModel(val.models[0]);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left ${
                  provider === key
                    ? "border-primary-500 bg-primary-500/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                    provider === key
                      ? "bg-primary-500 text-white"
                      : "bg-white/10 text-white/60"
                  }`}
                >
                  {val.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{val.name}</p>
                  <p className="text-xs text-white/40">
                    {key === "lyria"
                      ? "Pay-per-use"
                      : currentCredits !== null && currentCredits !== "Pay-per-use"
                      ? `${currentCredits} credits`
                      : "Not configured"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Model</label>
            <select
              value={providerModel}
              onChange={(e) => setProviderModel(e.target.value)}
              className="select-field"
            >
              {PROVIDERS[provider as keyof typeof PROVIDERS]?.models.map(
                (model) => (
                  <option key={model} value={model} className="bg-gray-900">
                    {model}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Language</label>
            <select
              value={language === "Other..." ? customLanguage : language}
              onChange={(e) => {
                if (e.target.value === "Other...") {
                  setLanguage("Other...");
                } else {
                  setLanguage(e.target.value);
                }
              }}
              className="select-field mb-2"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang} className="bg-gray-900">
                  {lang}
                </option>
              ))}
            </select>
            {language === "Other..." && (
              <input
                type="text"
                value={customLanguage}
                onChange={(e) => setCustomLanguage(e.target.value)}
                placeholder="Enter language..."
                className="input-field"
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={instrumental}
              onClick={() => setInstrumental(!instrumental)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                instrumental ? "bg-primary-500" : "bg-white/20"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  instrumental ? "translate-x-5" : ""
                }`}
              />
            </button>
            <span className="text-sm">Instrumental</span>
          </div>
        </div>
      </div>

      {!instrumental && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Lyrics</label>
            <button
              onClick={handleGenerateLyrics}
              disabled={!songIdea || generatingLyrics}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              {generatingLyrics ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Writing...
                </>
              ) : (
                <>🎵 AI Generate Lyrics</>
              )}
            </button>
          </div>
          {showLyrics && (
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Generated lyrics will appear here, or write your own..."
              className="input-field min-h-[150px] resize-y font-mono text-sm"
            />
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2">
          Title (optional)
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Give your track a name..."
          className="input-field"
        />
      </div>

      <button
        onClick={onGenerate}
        disabled={!songIdea}
        className="w-full btn-primary py-3 text-lg font-semibold"
      >
        🎶 Generate Track
      </button>
    </div>
  );
}
