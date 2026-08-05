"use client";

import React, { useState } from "react";

export type AIEditAction = "spelling" | "grammar" | "phonetic" | "translate" | "readability";

const ACTIONS: { key: AIEditAction; label: string; icon: string; desc: string }[] = [
  { key: "spelling",    label: "Spelling",    icon: "✓", desc: "Fix spelling mistakes" },
  { key: "grammar",     label: "Grammar",     icon: "✓", desc: "Correct grammar" },
  { key: "phonetic",    label: "Phonetic",    icon: "✓", desc: "Repair phonetic words" },
  { key: "translate",   label: "Translate",   icon: "✓", desc: "Translate lyrics" },
  { key: "readability", label: "Readability", icon: "✓", desc: "Improve flow & readability" },
];

const LANGUAGES = [
  "English", "Dutch", "French", "German", "Spanish", "Italian",
  "Portuguese", "Swedish", "Norwegian", "Danish", "Polish",
  "Russian", "Japanese", "Korean", "Chinese (Simplified)", "Arabic",
];

interface AIToolbarProps {
  hasLines: boolean;
  hasSelection: boolean;
  isLoading: boolean;
  selectionCount: number;
  onAction: (action: AIEditAction, options: { scope: "all" | "selection"; language?: string }) => void;
}

export default function AIToolbar({
  hasLines,
  hasSelection,
  isLoading,
  selectionCount,
  onAction,
}: AIToolbarProps) {
  const [scope, setScope] = useState<"all" | "selection">("all");
  const [translateLang, setTranslateLang] = useState("English");
  const [customLang, setCustomLang] = useState("");
  const [activeAction, setActiveAction] = useState<AIEditAction | null>(null);

  const effectiveLang = translateLang === "Other..." ? customLang.trim() || "English" : translateLang;

  async function handleAction(action: AIEditAction) {
    if (isLoading) return;
    setActiveAction(action);
    await onAction(action, {
      scope: hasSelection ? scope : "all",
      language: action === "translate" ? effectiveLang : undefined,
    });
    setActiveAction(null);
  }

  return (
    <div className="tce-ai-toolbar" role="toolbar" aria-label="AI editing tools">
      <div className="tce-ai-toolbar__header">
        <div className="tce-ai-toolbar__title">
          <span className="tce-ai-icon">✦</span>
          <span>AI Tools</span>
        </div>

        {/* Scope toggle */}
        <div className="tce-scope-toggle">
          <button
            className={`tce-scope-btn${scope === "all" ? " tce-scope-btn--active" : ""}`}
            onClick={() => setScope("all")}
            aria-pressed={scope === "all"}
          >
            All lines
          </button>
          <button
            className={`tce-scope-btn${scope === "selection" ? " tce-scope-btn--active" : ""}${!hasSelection ? " tce-scope-btn--disabled" : ""}`}
            onClick={() => hasSelection && setScope("selection")}
            disabled={!hasSelection}
            aria-pressed={scope === "selection"}
            title={!hasSelection ? "Select rows to use this mode" : `Apply to ${selectionCount} selected lines`}
          >
            Selection {hasSelection ? `(${selectionCount})` : ""}
          </button>
        </div>
      </div>

      <div className="tce-ai-toolbar__actions">
        {ACTIONS.map(({ key, label, icon, desc }) => {
          const isThisLoading = isLoading && activeAction === key;
          return (
            <div key={key} className="tce-ai-action-wrap">
              <button
                className={`tce-ai-btn${isThisLoading ? " tce-ai-btn--loading" : ""}`}
                onClick={() => handleAction(key)}
                disabled={!hasLines || isLoading}
                title={desc}
                aria-label={desc}
                id={`tce-ai-${key}`}
              >
                {isThisLoading ? (
                  <span className="tce-spinner" aria-hidden="true" />
                ) : (
                  <span className="tce-ai-btn__icon">{icon}</span>
                )}
                <span className="tce-ai-btn__label">{label}</span>
              </button>

              {/* Translate language selector inline */}
              {key === "translate" && (
                <div className="tce-translate-opts">
                  <select
                    className="tce-lang-select"
                    value={translateLang}
                    onChange={(e) => setTranslateLang(e.target.value)}
                    disabled={isLoading}
                    aria-label="Target language"
                    id="tce-translate-lang"
                  >
                    {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                    <option value="Other...">Other...</option>
                  </select>
                  {translateLang === "Other..." && (
                    <input
                      className="tce-lang-input"
                      type="text"
                      value={customLang}
                      onChange={(e) => setCustomLang(e.target.value)}
                      placeholder="Enter language..."
                      aria-label="Custom language"
                      id="tce-translate-custom"
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
