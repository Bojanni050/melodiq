"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import ApiLoggingCard from "@/components/settings/ApiLoggingCard";
import CoverArtSection from "@/components/settings/CoverArtSection";
import LLMRoutingSection from "@/components/settings/LLMRoutingSection";
import MinimaxSection from "@/components/settings/MinimaxSection";
import ModelDetailModal from "@/components/settings/ModelDetailModal";
import MusicGptRecoverySection from "@/components/settings/MusicGptRecoverySection";
import ProviderSection from "@/components/settings/ProviderSection";
import S3Section from "@/components/settings/S3Section";
import WebhooksSection from "@/components/settings/WebhooksSection";
import { PROVIDERS } from "@/lib/settings-constants";
import { applyWebhookDefaults, createModelPlaceholder, LLMModel } from "@/lib/settings-utils";

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [allModels, setAllModels] = useState<LLMModel[]>([]);
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [showPromptModelDropdown, setShowPromptModelDropdown] = useState(false);
  const [showLyricsModelDropdown, setShowLyricsModelDropdown] = useState(false);
  const [showImageModelDropdown, setShowImageModelDropdown] = useState(false);
  const [selectedPromptModel, setSelectedPromptModel] = useState<LLMModel | null>(null);
  const [selectedLyricsModel, setSelectedLyricsModel] = useState<LLMModel | null>(null);
  const [selectedImageModel, setSelectedImageModel] = useState<LLMModel | null>(null);
  const [modelDetail, setModelDetail] = useState<LLMModel | null>(null);
  const [testingModels, setTestingModels] = useState(false);
  const [apiLoggingSaving, setApiLoggingSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        const settings = {
          ...data,
          PROMPT_LLM_PROVIDER: data.PROMPT_LLM_PROVIDER || "openrouter",
          LYRICS_LLM_PROVIDER: data.LYRICS_LLM_PROVIDER || "openrouter",
          OPENROUTER_PROMPT_MODEL: data.OPENROUTER_PROMPT_MODEL || data.OPENROUTER_MODEL || "",
          OPENROUTER_LYRICS_MODEL: data.OPENROUTER_LYRICS_MODEL || data.OPENROUTER_MODEL || "",
          OPENAI_PROMPT_MODEL: data.OPENAI_PROMPT_MODEL || data.OPENAI_MODEL || "gpt-4o",
          OPENAI_LYRICS_MODEL: data.OPENAI_LYRICS_MODEL || data.OPENAI_MODEL || "gpt-4o",
        };
        setValues(applyWebhookDefaults(settings));
        if (settings.OPENROUTER_PROMPT_MODEL) setSelectedPromptModel(createModelPlaceholder(settings.OPENROUTER_PROMPT_MODEL));
        if (settings.OPENROUTER_LYRICS_MODEL) setSelectedLyricsModel(createModelPlaceholder(settings.OPENROUTER_LYRICS_MODEL));
        if (settings.OPENROUTER_IMAGE_MODEL) setSelectedImageModel(createModelPlaceholder(settings.OPENROUTER_IMAGE_MODEL));
      }
    }
    loadSettings();
  }, []);

  function updateField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function getOpenRouterModels() {
    const apiKey = values.OPENROUTER_API_KEY || "";
    if (!apiKey) return;
    setTestingModels(true);
    try {
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openrouter", apiKey }),
      });
      const data = await res.json();
      if (data.success) {
        const fetched: LLMModel[] = data.models || [];
        setAllModels(fetched);
        setModelSearchQuery("");
        const matchPrompt = fetched.find((m) => m.id === (values.OPENROUTER_PROMPT_MODEL || values.OPENROUTER_MODEL));
        const matchLyrics = fetched.find((m) => m.id === (values.OPENROUTER_LYRICS_MODEL || values.OPENROUTER_MODEL));
        const matchImage = fetched.find((m) => m.id === values.OPENROUTER_IMAGE_MODEL);
        if (matchPrompt) setSelectedPromptModel(matchPrompt);
        if (matchLyrics) setSelectedLyricsModel(matchLyrics);
        if (matchImage) setSelectedImageModel(matchImage);
      }
    } finally {
      setTestingModels(false);
    }
  }

  function selectPromptModel(model: LLMModel) {
    setSelectedPromptModel(model);
    updateField("OPENROUTER_PROMPT_MODEL", model.id);
    setShowPromptModelDropdown(false);
  }

  function selectLyricsModel(model: LLMModel) {
    setSelectedLyricsModel(model);
    updateField("OPENROUTER_LYRICS_MODEL", model.id);
    setShowLyricsModelDropdown(false);
  }

  function selectImageModel(model: LLMModel) {
    setSelectedImageModel(model);
    updateField("OPENROUTER_IMAGE_MODEL", model.id);
    setShowImageModelDropdown(false);
  }

  async function saveApiLogging() {
    setApiLoggingSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "ENABLE_API_LOGGING", value: values.ENABLE_API_LOGGING === "true" ? "true" : "false" }),
    });
    setApiLoggingSaving(false);
  }

  const filteredModels = modelSearchQuery
    ? allModels.filter((m) => m.id.toLowerCase().includes(modelSearchQuery.toLowerCase()) || m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()))
    : allModels;

  const musicProviders = PROVIDERS.filter((p) => ["lyria", "poyo", "tempolor", "musicgpt"].includes(p.id));
  const llmProviders = PROVIDERS.filter((p) => ["openrouter", "openai"].includes(p.id));
  const openrouterProvider = llmProviders.find((p) => p.id === "openrouter")!;
  const openaiProvider = llmProviders.find((p) => p.id === "openai")!;

  return (
    <div className="h-screen bg-[#0a0a0f] overflow-hidden">
      <Sidebar credits={null} />
      <div className="lg:ml-60 h-[calc(100vh-var(--player-height))] overflow-y-auto">
        <div className="sticky top-0 z-20 bg-[#0a0a0f]/95 backdrop-blur-sm border-b border-white/5">
          <div className="px-4 py-3">
            <h1 className="text-lg font-bold">Settings</h1>
            <p className="text-xs text-white/40 mt-0.5">Configure your API providers</p>
          </div>
        </div>
        <main className="p-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 max-w-[1600px]">

            {/* Column 1 — Music Providers */}
            <div className="space-y-4">
              <section className="section-card">
                <div className="mb-2">
                  <h2 className="text-sm font-semibold">Music Providers</h2>
                  <p className="text-xs text-white/30">Configure music generation APIs and webhooks.</p>
                </div>
              </section>

              {musicProviders.map((provider) => (
                <ProviderSection key={provider.id} provider={provider} values={values} onFieldChange={updateField} />
              ))}

              <MinimaxSection values={values} onFieldChange={updateField} />
              <MusicGptRecoverySection />
              <WebhooksSection values={values} onFieldChange={updateField} />
            </div>

            {/* Column 2 — AI & Models */}
            <div className="space-y-4">
              <section className="section-card">
                <div className="mb-2">
                  <h2 className="text-sm font-semibold">AI & Models</h2>
                  <p className="text-xs text-white/30">LLM routing, model selection, and cover generation.</p>
                </div>
              </section>

              <LLMRoutingSection values={values} onFieldChange={updateField} />

              <ProviderSection
                provider={openrouterProvider}
                values={values}
                onFieldChange={updateField}
                openRouterProps={{
                  allModels,
                  filteredModels,
                  modelSearchQuery,
                  selectedPromptModel,
                  selectedLyricsModel,
                  selectedImageModel,
                  showPromptDropdown: showPromptModelDropdown,
                  showLyricsDropdown: showLyricsModelDropdown,
                  showImageDropdown: showImageModelDropdown,
                  onSearchQueryChange: setModelSearchQuery,
                  onPromptModelSelect: selectPromptModel,
                  onLyricsModelSelect: selectLyricsModel,
                  onImageModelSelect: selectImageModel,
                  onTogglePromptDropdown: () => { setShowPromptModelDropdown((v) => !v); setShowLyricsModelDropdown(false); setShowImageModelDropdown(false); },
                  onToggleLyricsDropdown: () => { setShowLyricsModelDropdown((v) => !v); setShowPromptModelDropdown(false); setShowImageModelDropdown(false); },
                  onToggleImageDropdown: () => { setShowImageModelDropdown((v) => !v); setShowPromptModelDropdown(false); setShowLyricsModelDropdown(false); },
                  onReadMore: setModelDetail,
                  testingModels,
                  onGetModels: getOpenRouterModels,
                }}
              />

              <ProviderSection provider={openaiProvider} values={values} onFieldChange={updateField} />

              <CoverArtSection value={values.PIXAZO_API_KEY ?? ""} onChange={(v) => updateField("PIXAZO_API_KEY", v)} />
            </div>

            {/* Column 3 — Storage & Diagnostics */}
            <div className="space-y-4">
              <section className="section-card">
                <div className="mb-2">
                  <h2 className="text-sm font-semibold">Storage & Diagnostics</h2>
                  <p className="text-xs text-white/30">Object storage settings and debugging controls.</p>
                </div>
              </section>

              <S3Section values={values} onFieldChange={updateField} />

              <ApiLoggingCard
                enabled={values.ENABLE_API_LOGGING === "true"}
                saving={apiLoggingSaving}
                onToggle={() => updateField("ENABLE_API_LOGGING", values.ENABLE_API_LOGGING === "true" ? "false" : "true")}
                onSave={saveApiLogging}
              />
            </div>

          </div>
        </main>
      </div>

      <ModelDetailModal modelDetail={modelDetail} onClose={() => setModelDetail(null)} />
    </div>
  );
}
