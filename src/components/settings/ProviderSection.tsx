"use client";

import { useState } from "react";
import OpenRouterModelDropdown from "@/components/settings/OpenRouterModelDropdown";
import ProviderCard from "@/components/settings/ProviderCard";
import type { LLMModel } from "@/lib/settings-utils";
import type { ProviderConfig } from "@/lib/settings-constants";

interface OpenRouterModelProps {
  allModels: LLMModel[];
  filteredModels: LLMModel[];
  modelSearchQuery: string;
  selectedPromptModel: LLMModel | null;
  selectedLyricsModel: LLMModel | null;
  selectedImageModel: LLMModel | null;
  showPromptDropdown: boolean;
  showLyricsDropdown: boolean;
  showImageDropdown: boolean;
  onSearchQueryChange: (query: string) => void;
  onPromptModelSelect: (model: LLMModel) => void;
  onLyricsModelSelect: (model: LLMModel) => void;
  onImageModelSelect: (model: LLMModel) => void;
  onTogglePromptDropdown: () => void;
  onToggleLyricsDropdown: () => void;
  onToggleImageDropdown: () => void;
  onReadMore: (model: LLMModel) => void;
  testingModels: boolean;
  onGetModels: () => void;
}

export default function ProviderSection({
  provider,
  values,
  onFieldChange,
  openRouterProps,
}: {
  provider: ProviderConfig;
  values: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  openRouterProps?: OpenRouterModelProps;
}) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleSave() {
    setSaving(true);
    for (const field of provider.fields) {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: field.key, value: values[field.key] || "" }),
      });
    }

    if (provider.id === "openrouter") {
      for (const key of ["OPENROUTER_PROMPT_MODEL", "OPENROUTER_LYRICS_MODEL", "OPENROUTER_IMAGE_MODEL"] as const) {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value: values[key] || values.OPENROUTER_MODEL || "" }),
        });
      }
    }

    if (provider.id === "openai") {
      for (const key of ["OPENAI_PROMPT_MODEL", "OPENAI_LYRICS_MODEL"] as const) {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value: values[key] || "" }),
        });
      }
    }

    setSaving(false);
  }

  async function handleTest() {
    setTesting(true);
    const apiKey = values[provider.fields[0].key] || "";
    const res = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: provider.testEndpoint, apiKey }),
    });
    const data = await res.json();
    setTestResult({ success: data.success, message: data.message });
    setTesting(false);
  }

  return (
    <ProviderCard title={provider.name} description={provider.description}>
      {provider.fields.map((field) => (
        <div key={field.key}>
          <label className="block text-xs font-medium text-white/50 mb-1">{field.label}</label>
          <input
            type={field.type}
            value={values[field.key] || ""}
            onChange={(e) => onFieldChange(field.key, e.target.value)}
            className="input-field font-mono text-sm"
            placeholder={field.placeholder}
          />
        </div>
      ))}

      {provider.id === "openrouter" && openRouterProps && (
        <>
          <OpenRouterModelDropdown
            label="Prompt Model"
            selected={openRouterProps.selectedPromptModel}
            open={openRouterProps.showPromptDropdown}
            options={openRouterProps.filteredModels}
            allModelsLoaded={openRouterProps.allModels.length > 0}
            searchQuery={openRouterProps.modelSearchQuery}
            onToggle={openRouterProps.onTogglePromptDropdown}
            onSelect={openRouterProps.onPromptModelSelect}
            onSearchQueryChange={openRouterProps.onSearchQueryChange}
            onReadMore={openRouterProps.onReadMore}
          />
          <OpenRouterModelDropdown
            label="Lyrics Model"
            selected={openRouterProps.selectedLyricsModel}
            open={openRouterProps.showLyricsDropdown}
            options={openRouterProps.filteredModels}
            allModelsLoaded={openRouterProps.allModels.length > 0}
            searchQuery={openRouterProps.modelSearchQuery}
            onToggle={openRouterProps.onToggleLyricsDropdown}
            onSelect={openRouterProps.onLyricsModelSelect}
            onSearchQueryChange={openRouterProps.onSearchQueryChange}
            onReadMore={openRouterProps.onReadMore}
          />
          <OpenRouterModelDropdown
            label="Image Prompt Model"
            selected={openRouterProps.selectedImageModel}
            open={openRouterProps.showImageDropdown}
            options={openRouterProps.filteredModels}
            allModelsLoaded={openRouterProps.allModels.length > 0}
            searchQuery={openRouterProps.modelSearchQuery}
            onToggle={openRouterProps.onToggleImageDropdown}
            onSelect={openRouterProps.onImageModelSelect}
            onSearchQueryChange={openRouterProps.onSearchQueryChange}
            onReadMore={openRouterProps.onReadMore}
          />
        </>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button onClick={handleSave} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={handleTest} disabled={testing} className="btn-secondary text-xs px-3 py-1.5">
          {testing ? "Testing..." : "Test Connection"}
        </button>
        {provider.id === "openrouter" && openRouterProps && (
          <button
            onClick={openRouterProps.onGetModels}
            disabled={openRouterProps.testingModels}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            {openRouterProps.testingModels ? "Loading Models..." : "Retrieve Models"}
          </button>
        )}
      </div>

      {testResult && (
        <p className={`text-xs ${testResult.success ? "text-green-400" : "text-red-400"}`}>
          {testResult.message}
        </p>
      )}
    </ProviderCard>
  );
}
