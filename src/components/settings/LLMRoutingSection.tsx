"use client";

import { useState } from "react";

export default function LLMRoutingSection({
  values,
  onFieldChange,
}: {
  values: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    for (const key of ["PROMPT_LLM_PROVIDER", "LYRICS_LLM_PROVIDER"]) {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: values[key] || "openrouter" }),
      });
    }
    setSaving(false);
  }

  return (
    <section className="section-card">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">LLM Routing</h2>
        <p className="text-xs text-white/30">
          Kies apart welke provider prompt-generatie en lyric-generatie gebruikt.
        </p>
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1">Prompt provider</label>
          <select
            value={values.PROMPT_LLM_PROVIDER || "openrouter"}
            onChange={(e) => onFieldChange("PROMPT_LLM_PROVIDER", e.target.value)}
            className="select-field font-mono text-sm"
          >
            <option value="openrouter">OpenRouter</option>
            <option value="openai">OpenAI</option>
          </select>
          <p className="text-xs text-white/25 mt-1">Used by Generate Style / prompt optimization.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1">Lyrics provider</label>
          <select
            value={values.LYRICS_LLM_PROVIDER || "openrouter"}
            onChange={(e) => onFieldChange("LYRICS_LLM_PROVIDER", e.target.value)}
            className="select-field font-mono text-sm"
          >
            <option value="openrouter">OpenRouter</option>
            <option value="openai">OpenAI</option>
          </select>
          <p className="text-xs text-white/25 mt-1">Used by Generate Lyrics and Lyric Studio block generation.</p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button onClick={handleSave} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
            {saving ? "Saving..." : "Save LLM Routing"}
          </button>
        </div>
      </div>
    </section>
  );
}
