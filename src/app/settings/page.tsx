"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import ApiLoggingCard from "@/components/settings/ApiLoggingCard";
import ModelDetailModal from "@/components/settings/ModelDetailModal";
import ModelSelector from "@/components/settings/ModelSelector";
import ProviderCard from "@/components/settings/ProviderCard";
import WebhookRow from "@/components/settings/WebhookRow";
import { PROVIDERS, ProviderConfig, WEBHOOK_DEFAULTS } from "@/lib/settings-constants";
import {
  applyWebhookDefaults,
  buildWebhookUrl,
  createModelPlaceholder,
  LLMModel,
} from "@/lib/settings-utils";

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [models, setModels] = useState<LLMModel[]>([]);
  const [allModels, setAllModels] = useState<LLMModel[]>([]);
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [showPromptModelDropdown, setShowPromptModelDropdown] = useState(false);
  const [showLyricsModelDropdown, setShowLyricsModelDropdown] = useState(false);
  const [showImageModelDropdown, setShowImageModelDropdown] = useState(false);
  const [selectedPromptModel, setSelectedPromptModel] = useState<LLMModel | null>(null);
  const [selectedLyricsModel, setSelectedLyricsModel] = useState<LLMModel | null>(null);
  const [selectedImageModel, setSelectedImageModel] = useState<LLMModel | null>(null);
  const [modelDetail, setModelDetail] = useState<LLMModel | null>(null);
  const [s3Config, setS3Config] = useState<{ endpoint: string; region: string; bucket: string; forcePathStyle: boolean } | null>(null);
  const [s3Status, setS3Status] = useState<{ connected: boolean; message: string } | null>(null);
  const [testingS3, setTestingS3] = useState(false);
  const [recoveringMusicgpt, setRecoveringMusicgpt] = useState(false);
  const [musicgptRecoveryResult, setMusicgptRecoveryResult] = useState<{
    success: boolean;
    message: string;
    recovered?: number;
    still_processing?: number;
    total?: number;
    results?: {
      trackId: string;
      conversionId: string;
      outcome: "recovered" | "still_processing" | "failed" | "no_audio";
      detail?: string;
    }[];
  } | null>(null);
  const [s3Stats, setS3Stats] = useState<{ totalSize: number; objectCount: number; formattedSize: string } | null>(null);
  const [loadingS3Stats, setLoadingS3Stats] = useState(false);

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
        if (settings.OPENROUTER_PROMPT_MODEL) {
          setSelectedPromptModel(createModelPlaceholder(settings.OPENROUTER_PROMPT_MODEL));
        }
        if (settings.OPENROUTER_LYRICS_MODEL) {
          setSelectedLyricsModel(createModelPlaceholder(settings.OPENROUTER_LYRICS_MODEL));
        }
        if (settings.OPENROUTER_IMAGE_MODEL) {
          setSelectedImageModel(createModelPlaceholder(settings.OPENROUTER_IMAGE_MODEL));
        }
      }

      const s3Res = await fetch("/api/settings/s3");
      if (s3Res.ok) {
        setS3Config(await s3Res.json());
      }
    }
    loadSettings();
  }, []);

  function updateField(key: string, value: string) {
    setValues((prev) => {
      const next = { ...prev, [key]: value };

      if (key === "APP_URL" && value.trim()) {
        for (const { key: webhookKey, path } of WEBHOOK_DEFAULTS) {
          if (!next[webhookKey]) {
            next[webhookKey] = buildWebhookUrl(value, path);
          }
        }
      }

      return next;
    });
  }

  async function getOpenRouterModels() {
    const apiKey = values.OPENROUTER_API_KEY || "";
    if (!apiKey) {
      setTestResults((prev) => ({
        ...prev,
        openrouter: { success: false, message: "Enter OpenRouter API key first" },
      }));
      return;
    }

    setTesting((prev) => ({ ...prev, openrouterModels: true }));

    try {
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openrouter", apiKey }),
      });

      const data = await res.json();

      if (!data.success) {
        setTestResults((prev) => ({
          ...prev,
          openrouter: { success: false, message: data.message || "Failed to get models" },
        }));
        return;
      }

      const fetchedModels: LLMModel[] = data.models || [];
      setAllModels(fetchedModels);
      setModels(fetchedModels);
      setModelSearchQuery("");

      if (values.OPENROUTER_PROMPT_MODEL || values.OPENROUTER_MODEL) {
        const matched = fetchedModels.find(
          (m) => m.id === (values.OPENROUTER_PROMPT_MODEL || values.OPENROUTER_MODEL)
        );
        if (matched) {
          setSelectedPromptModel(matched);
        }
      }

      if (values.OPENROUTER_LYRICS_MODEL || values.OPENROUTER_MODEL) {
        const matched = fetchedModels.find(
          (m) => m.id === (values.OPENROUTER_LYRICS_MODEL || values.OPENROUTER_MODEL)
        );
        if (matched) {
          setSelectedLyricsModel(matched);
        }
      }

      if (values.OPENROUTER_IMAGE_MODEL) {
        const matchedImage = fetchedModels.find((m) => m.id === values.OPENROUTER_IMAGE_MODEL);
        if (matchedImage) {
          setSelectedImageModel(matchedImage);
        }
      }

      setTestResults((prev) => ({
        ...prev,
        openrouter: {
          success: true,
          message: `Loaded ${fetchedModels.length} OpenRouter models`,
        },
      }));
    } catch {
      setTestResults((prev) => ({
        ...prev,
        openrouter: { success: false, message: "Failed to fetch OpenRouter models" },
      }));
    } finally {
      setTesting((prev) => ({ ...prev, openrouterModels: false }));
    }
  }

  async function saveProvider(provider: ProviderConfig) {
    setSaving((prev) => ({ ...prev, [provider.id]: true }));

    for (const field of provider.fields) {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: field.key, value: values[field.key] || "" }),
      });
    }

    if (provider.id === "openrouter") {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "OPENROUTER_PROMPT_MODEL", value: values.OPENROUTER_PROMPT_MODEL || values.OPENROUTER_MODEL || "" }),
      });

      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "OPENROUTER_LYRICS_MODEL", value: values.OPENROUTER_LYRICS_MODEL || values.OPENROUTER_MODEL || "" }),
      });

      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "OPENROUTER_IMAGE_MODEL", value: values.OPENROUTER_IMAGE_MODEL || "" }),
      });
    }

    if (provider.id === "openai") {
      const openAiFields = ["OPENAI_PROMPT_MODEL", "OPENAI_LYRICS_MODEL"];
      for (const key of openAiFields) {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value: values[key] || "" }),
        });
      }
    }

    setSaving((prev) => ({ ...prev, [provider.id]: false }));
  }

  async function saveWebhooks() {
    setSaving((prev) => ({ ...prev, webhooks: true }));

    const appUrl = values.APP_URL?.trim();

    const webhookFields = [
      "APP_URL",
      "POYO_WEBHOOK_URL",
      "POYO_WAV_WEBHOOK_URL",
      "TEMPOLOR_WEBHOOK_URL",
      "MUSICGPT_WEBHOOK_URL",
      "MINIMAX_WEBHOOK_URL",
    ];

    for (const key of webhookFields) {
      const value =
        key === "APP_URL" || !appUrl
          ? values[key] || ""
          : values[key] || buildWebhookUrl(appUrl, WEBHOOK_DEFAULTS.find((field) => field.key === key)?.path || "");

      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
    }

    setSaving((prev) => ({ ...prev, webhooks: false }));
  }

  async function recoverMusicgptTracks() {
    setRecoveringMusicgpt(true);
    setMusicgptRecoveryResult(null);
    try {
      const res = await fetch("/api/tracks/recover-musicgpt", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMusicgptRecoveryResult({
          success: true,
          message: data.message,
          recovered: data.recovered,
          still_processing: data.still_processing,
          total: data.total,
          results: data.results ?? [],
        });
      } else {
        setMusicgptRecoveryResult({
          success: false,
          message: data.error || "Recovery failed",
        });
      }
    } catch {
      setMusicgptRecoveryResult({
        success: false,
        message: "Network error — could not reach recovery endpoint",
      });
    } finally {
      setRecoveringMusicgpt(false);
    }
  }

  async function testProvider(provider: ProviderConfig) {
    setTesting((prev) => ({ ...prev, [provider.id]: true }));

    const apiKey = values[provider.fields[0].key] || "";

    const res = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: provider.testEndpoint, apiKey }),
    });

    const data = await res.json();
    setTestResults((prev) => ({
      ...prev,
      [provider.id]: { success: data.success, message: data.message },
    }));

    if (data.models && data.models.length > 0) {
      setAllModels(data.models);
      setModels(data.models);
    }

    setTesting((prev) => ({ ...prev, [provider.id]: false }));
  }

  async function testS3() {
    setTestingS3(true);
    setS3Status(null);
    const res = await fetch("/api/settings/s3", { method: "POST" });
    const data = await res.json();
    setS3Status(data);
    setTestingS3(false);
  }

  async function fetchS3Stats() {
    setLoadingS3Stats(true);
    try {
      const res = await fetch("/api/settings/s3/stats");
      const data = await res.json();
      if (res.ok) {
        setS3Stats(data);
      }
    } catch (error) {
      console.error("Error fetching S3 stats:", error);
    }
    setLoadingS3Stats(false);
  }

  async function saveApiLogging() {
    setSaving((prev) => ({ ...prev, apiLogging: true }));
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "ENABLE_API_LOGGING",
        value: values.ENABLE_API_LOGGING === "true" ? "true" : "false",
      }),
    });
    setSaving((prev) => ({ ...prev, apiLogging: false }));
  }

  async function saveMinimaxProvider() {
    setSaving((prev) => ({ ...prev, minimax: true }));
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "MINIMAX_USE_POYO", value: values.MINIMAX_USE_POYO === "true" ? "true" : "false" }),
    });
    if (values.MINIMAX_USE_POYO !== "true") {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "MINIMAX_API_KEY", value: values.MINIMAX_API_KEY || "" }),
      });
    }
    setSaving((prev) => ({ ...prev, minimax: false }));
  }

  async function testMinimaxProvider() {
    setTesting((prev) => ({ ...prev, minimax: true }));
    const apiKey = values.MINIMAX_API_KEY || "";
    const res = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "minimax", apiKey }),
    });
    const data = await res.json();
    setTestResults((prev) => ({
      ...prev,
      minimax: { success: data.success, message: data.message },
    }));
    setTesting((prev) => ({ ...prev, minimax: false }));
  }

  async function saveLLMRouting() {
    setSaving((prev) => ({ ...prev, llmRouting: true }));
    const routingFields = ["PROMPT_LLM_PROVIDER", "LYRICS_LLM_PROVIDER"];
    for (const key of routingFields) {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: values[key] || "openrouter" }),
      });
    }
    setSaving((prev) => ({ ...prev, llmRouting: false }));
  }

  function selectPromptModel(model: LLMModel) {
    setSelectedPromptModel(model);
    setValues((prev) => ({ ...prev, OPENROUTER_PROMPT_MODEL: model.id }));
    setShowPromptModelDropdown(false);
  }

  function selectLyricsModel(model: LLMModel) {
    setSelectedLyricsModel(model);
    setValues((prev) => ({ ...prev, OPENROUTER_LYRICS_MODEL: model.id }));
    setShowLyricsModelDropdown(false);
  }

  function selectImageModel(model: LLMModel) {
    setSelectedImageModel(model);
    setValues((prev) => ({ ...prev, OPENROUTER_IMAGE_MODEL: model.id }));
    setShowImageModelDropdown(false);
  }

  function renderOpenRouterModelSelect({
    label,
    selected,
    open,
    onToggle,
    onSelect,
  }: {
    label: string;
    selected: LLMModel | null;
    open: boolean;
    onToggle: () => void;
    onSelect: (model: LLMModel) => void;
  }) {
    return (
      <div className="relative">
        <label className="block text-xs font-medium text-white/50 mb-1">{label}</label>
        {allModels.length > 0 ? (
          <button
            type="button"
            onClick={onToggle}
            className="w-full input-field font-mono text-sm text-left flex items-center justify-between"
          >
            <span className="truncate">
              {selected ? selected.name : "Select a model..."}
            </span>
            <svg className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        ) : (
          <div className="input-field font-mono text-sm text-white/60">
            {selected ? selected.name : "Retrieve models to select"}
          </div>
        )}

        {open && filteredModels.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-white/10 bg-[#1a1a24] p-2 shadow-xl">
            <ModelSelector
              label={`${label} options`}
              selected={selected}
              options={filteredModels}
              searchQuery={modelSearchQuery}
              onSearchQueryChange={setModelSearchQuery}
              onSelect={onSelect}
              onReadMore={setModelDetail}
            />
          </div>
        )}
      </div>
    );
  }

  function renderProviderSection(provider: ProviderConfig) {
    return (
      <ProviderCard key={provider.id} title={provider.name} description={provider.description}>
        {provider.fields.map((field) => (
          <div key={field.key}>
            <label className="block text-xs font-medium text-white/50 mb-1">
              {field.label}
            </label>
            <input
              type={field.type}
              value={values[field.key] || ""}
              onChange={(e) => updateField(field.key, e.target.value)}
              className="input-field font-mono text-sm"
              placeholder={field.placeholder}
            />
          </div>
        ))}

        {provider.id === "openrouter" &&
          renderOpenRouterModelSelect({
            label: "Prompt Model",
            selected: selectedPromptModel,
            open: showPromptModelDropdown,
            onToggle: () => {
              setShowPromptModelDropdown(!showPromptModelDropdown);
              setShowImageModelDropdown(false);
              setShowLyricsModelDropdown(false);
            },
            onSelect: selectPromptModel,
          })}

        {provider.id === "openrouter" &&
          renderOpenRouterModelSelect({
            label: "Lyrics Model",
            selected: selectedLyricsModel,
            open: showLyricsModelDropdown,
            onToggle: () => {
              setShowLyricsModelDropdown(!showLyricsModelDropdown);
              setShowPromptModelDropdown(false);
              setShowImageModelDropdown(false);
            },
            onSelect: selectLyricsModel,
          })}

        {provider.id === "openrouter" &&
          renderOpenRouterModelSelect({
            label: "Image Prompt Model",
            selected: selectedImageModel,
            open: showImageModelDropdown,
            onToggle: () => {
              setShowImageModelDropdown(!showImageModelDropdown);
              setShowPromptModelDropdown(false);
              setShowLyricsModelDropdown(false);
            },
            onSelect: selectImageModel,
          })}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => saveProvider(provider)}
            disabled={saving[provider.id]}
            className="btn-primary text-xs px-3 py-1.5"
          >
            {saving[provider.id] ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => testProvider(provider)}
            disabled={testing[provider.id]}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            {testing[provider.id] ? "Testing..." : "Test Connection"}
          </button>
          {provider.id === "openrouter" && (
            <button
              onClick={() => getOpenRouterModels()}
              disabled={testing.openrouterModels}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              {testing.openrouterModels ? "Loading Models..." : "Retrieve Models"}
            </button>
          )}
        </div>

        {testResults[provider.id] && (
          <p
            className={`text-xs ${
              testResults[provider.id].success
                ? "text-green-400"
                : "text-red-400"
            }`}
          >
            {testResults[provider.id].message}
          </p>
        )}
      </ProviderCard>
    );
  }

  const filteredModels = modelSearchQuery
    ? allModels.filter(
        (m) =>
          m.id.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
          m.name.toLowerCase().includes(modelSearchQuery.toLowerCase())
      )
    : allModels;

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
            <div className="space-y-4">
              <section className="section-card">
                <div className="mb-2">
                  <h2 className="text-sm font-semibold">Music Providers</h2>
                  <p className="text-xs text-white/30">Configure music generation APIs and webhooks.</p>
                </div>
              </section>

              {PROVIDERS.filter((provider) => ["lyria", "poyo", "tempolor", "musicgpt"].includes(provider.id)).map((provider) =>
                renderProviderSection(provider)
              )}

              {/* Minimax — with Use PoYo toggle */}
              <ProviderCard
                title="MiniMax Music 2.6"
                description="Synchronous music generation with lyrics support"
              >
                  {/* Use PoYo toggle */}
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                    <div>
                      <p className="text-sm text-white/80">Use PoYo</p>
                      <p className="text-xs text-white/30">Route Minimax generation through PoYo API</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={values.MINIMAX_USE_POYO === "true"}
                      onClick={() => updateField("MINIMAX_USE_POYO", values.MINIMAX_USE_POYO === "true" ? "false" : "true")}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        values.MINIMAX_USE_POYO === "true" ? "bg-primary-500/40" : "bg-white/10"
                      }`}
                    >
                      <span className="sr-only">Use PoYo for Minimax</span>
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                          values.MINIMAX_USE_POYO === "true" ? "translate-x-6" : ""
                        }`}
                      />
                    </button>
                  </div>

                  {/* API Key field — disabled when using PoYo */}
                  {values.MINIMAX_USE_POYO !== "true" && (
                    <div>
                      <label className="block text-xs font-medium text-white/50 mb-1">API Key</label>
                      <input
                        type="password"
                        value={values.MINIMAX_API_KEY || ""}
                        onChange={(e) => updateField("MINIMAX_API_KEY", e.target.value)}
                        className="input-field font-mono text-sm"
                        placeholder="minimax_..."
                      />
                    </div>
                  )}

                  {values.MINIMAX_USE_POYO === "true" && (
                    <p className="text-xs text-white/30">
                      Using PoYo API key for Minimax generation. Ensure PoYo is configured above.
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => saveMinimaxProvider()}
                      disabled={saving.minimax}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      {saving.minimax ? "Saving..." : "Save"}
                    </button>
                    {values.MINIMAX_USE_POYO !== "true" && (
                      <button
                        onClick={() => testMinimaxProvider()}
                        disabled={testing.minimax}
                        className="btn-secondary text-xs px-3 py-1.5"
                      >
                        {testing.minimax ? "Testing..." : "Test Connection"}
                      </button>
                    )}
                  </div>

                  {testResults.minimax && (
                    <p className={`text-xs ${testResults.minimax.success ? "text-green-400" : "text-red-400"}`}>
                      {testResults.minimax.message}
                    </p>
                  )}
              </ProviderCard>

              {/* MusicGPT Recovery */}
              <section className="section-card">
                <h2 className="text-sm font-semibold mb-1">MusicGPT — Track Recovery</h2>
                <p className="text-xs text-white/40 mb-3">
                  Haal tracks op die vastzitten op &ldquo;generating&rdquo; door de MusicGPT API
                  rechtstreeks te pollen op status. Veilig om meerdere keren aan te roepen.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={recoverMusicgptTracks}
                    disabled={recoveringMusicgpt}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    {recoveringMusicgpt ? "Recovering..." : "Recover Stuck Tracks"}
                  </button>
                </div>
                {musicgptRecoveryResult && (
                  <div className="mt-3 space-y-2">
                    <p className={`text-xs ${musicgptRecoveryResult.success ? "text-green-400" : "text-red-400"}`}>
                      {musicgptRecoveryResult.message}
                    </p>
                    {musicgptRecoveryResult.success && musicgptRecoveryResult.total !== undefined && (
                      <p className="text-xs text-white/30">
                        {musicgptRecoveryResult.recovered} recovered ·{" "}
                        {musicgptRecoveryResult.still_processing} still processing ·{" "}
                        {musicgptRecoveryResult.total} total
                      </p>
                    )}
                    {musicgptRecoveryResult.results && musicgptRecoveryResult.results.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {musicgptRecoveryResult.results.map((r) => {
                          const outcomeColor =
                            r.outcome === "recovered" ? "text-green-400" :
                            r.outcome === "still_processing" ? "text-yellow-400" :
                            r.outcome === "no_audio" ? "text-orange-400" :
                            "text-red-400";
                          const outcomeLabel =
                            r.outcome === "recovered" ? "✓ Recovered" :
                            r.outcome === "still_processing" ? "⟳ Still processing" :
                            r.outcome === "no_audio" ? "⚠ No audio" :
                            "✗ Failed";
                          return (
                            <div key={r.trackId} className="flex items-start gap-2 text-xs bg-white/5 rounded px-2 py-1.5">
                              <span className={`shrink-0 font-medium ${outcomeColor}`}>{outcomeLabel}</span>
                              <span className="text-white/30 font-mono truncate">{r.conversionId}</span>
                              {r.detail && (
                                <span className="text-white/20 ml-auto shrink-0 truncate max-w-[140px]" title={r.detail}>
                                  {r.detail}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Webhooks Section */}
              <section className="section-card">
                <h2 className="text-sm font-semibold mb-3">Webhooks</h2>
                <p className="text-xs text-white/40 mb-3">
                  Set your public app URL to auto-generate all webhook URLs, or override them individually.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">App URL</label>
                    <input
                      type="text"
                      value={values.APP_URL || ""}
                      onChange={(e) => updateField("APP_URL", e.target.value)}
                      className="input-field font-mono text-sm"
                      placeholder="https://sonara.yourdomain.com"
                    />
                    <p className="text-xs text-white/25 mt-1">Used to auto-derive webhook URLs below</p>
                  </div>
                  <WebhookRow
                    label="PoYo Webhook URL"
                    value={values.POYO_WEBHOOK_URL || ""}
                    onChange={(value) => updateField("POYO_WEBHOOK_URL", value)}
                    placeholder={values.APP_URL ? `${values.APP_URL.replace(/\/$/, "")}/api/webhooks/poyo` : "Leave empty to auto-derive"}
                  />
                  <WebhookRow
                    label="PoYo WAV Webhook URL"
                    value={values.POYO_WAV_WEBHOOK_URL || ""}
                    onChange={(value) => updateField("POYO_WAV_WEBHOOK_URL", value)}
                    placeholder={values.APP_URL ? `${values.APP_URL.replace(/\/$/, "")}/api/webhooks/poyo-wav` : "Leave empty to auto-derive"}
                  />
                  <WebhookRow
                    label="Tempolor Webhook URL"
                    value={values.TEMPOLOR_WEBHOOK_URL || ""}
                    onChange={(value) => updateField("TEMPOLOR_WEBHOOK_URL", value)}
                    placeholder={values.APP_URL ? `${values.APP_URL.replace(/\/$/, "")}/api/webhooks/tempolor` : "Leave empty to auto-derive"}
                  />
                  <WebhookRow
                    label="MusicGPT Webhook URL"
                    value={values.MUSICGPT_WEBHOOK_URL || ""}
                    onChange={(value) => updateField("MUSICGPT_WEBHOOK_URL", value)}
                    placeholder={values.APP_URL ? `${values.APP_URL.replace(/\/$/, "")}/api/webhooks/musicgpt` : "Leave empty to auto-derive"}
                  />
                  <WebhookRow
                    label="MiniMax Webhook URL"
                    value={values.MINIMAX_WEBHOOK_URL || ""}
                    onChange={(value) => updateField("MINIMAX_WEBHOOK_URL", value)}
                    placeholder={values.APP_URL ? `${values.APP_URL.replace(/\/$/, "")}/api/webhooks/minimax` : "Leave empty to auto-derive"}
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => saveWebhooks()}
                      disabled={saving.webhooks}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      {saving.webhooks ? "Saving..." : "Save Webhooks"}
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-4">
              <section className="section-card">
                <div className="mb-2">
                  <h2 className="text-sm font-semibold">AI & Models</h2>
                  <p className="text-xs text-white/30">LLM routing, model selection, and cover generation.</p>
                </div>
              </section>

              <section className="section-card">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold">LLM Routing</h2>
                  <p className="text-xs text-white/30">
                    Kies apart welke provider prompt-generatie en lyric-generatie gebruikt.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">
                      Prompt provider
                    </label>
                    <select
                      value={values.PROMPT_LLM_PROVIDER || "openrouter"}
                      onChange={(e) => updateField("PROMPT_LLM_PROVIDER", e.target.value)}
                      className="select-field font-mono text-sm"
                    >
                      <option value="openrouter">OpenRouter</option>
                      <option value="openai">OpenAI</option>
                    </select>
                    <p className="text-xs text-white/25 mt-1">
                      Used by Generate Style / prompt optimization.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">
                      Lyrics provider
                    </label>
                    <select
                      value={values.LYRICS_LLM_PROVIDER || "openrouter"}
                      onChange={(e) => updateField("LYRICS_LLM_PROVIDER", e.target.value)}
                      className="select-field font-mono text-sm"
                    >
                      <option value="openrouter">OpenRouter</option>
                      <option value="openai">OpenAI</option>
                    </select>
                    <p className="text-xs text-white/25 mt-1">
                      Used by Generate Lyrics and Lyric Studio block generation.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => saveLLMRouting()}
                      disabled={saving.llmRouting}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      {saving.llmRouting ? "Saving..." : "Save LLM Routing"}
                    </button>
                  </div>
                </div>
              </section>

              {PROVIDERS.filter((provider) => ["openrouter", "openai"].includes(provider.id)).map((provider) =>
                renderProviderSection(provider)
              )}

              {/* Cover Art */}
              <section className="section-card">
                <h2 className="text-sm font-semibold mb-3">Cover Art</h2>
                <p className="text-xs text-white/40 mb-3">
                  AI-generated cover art via Pixazo Flux 1 Schnell (free).
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Pixazo API Key</label>
                    <input
                      type="password"
                      value={values["PIXAZO_API_KEY"] ?? ""}
                      onChange={(e) => updateField("PIXAZO_API_KEY", e.target.value)}
                      placeholder="Your Pixazo subscription key"
                      className="input-field"
                    />
                    <p className="text-xs text-white/30 mt-1">
                      Get your key at pixazo.ai · Flux 1 Schnell is free
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      setSaving((prev) => ({ ...prev, coverart: true }));
                      await fetch("/api/settings", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key: "PIXAZO_API_KEY", value: values["PIXAZO_API_KEY"] || "" }),
                      });
                      setSaving((prev) => ({ ...prev, coverart: false }));
                    }}
                    disabled={saving.coverart}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    {saving.coverart ? "Saving..." : "Save"}
                  </button>
                </div>
              </section>
            </div>

            <div className="space-y-4">
              <section className="section-card">
                <div className="mb-2">
                  <h2 className="text-sm font-semibold">Storage & Diagnostics</h2>
                  <p className="text-xs text-white/30">Object storage settings and debugging controls.</p>
                </div>
              </section>

              {/* S3 Storage Section */}
              <section className="section-card">
                <h2 className="text-sm font-semibold mb-3">S3 Storage</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Endpoint</label>
                    <input
                      type="text"
                      value={values.S3_ENDPOINT || ""}
                      onChange={(e) => updateField("S3_ENDPOINT", e.target.value)}
                      className="input-field font-mono text-sm"
                      placeholder="https://s3.example.com or https://minio.local"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Region</label>
                    <input
                      type="text"
                      value={values.AWS_REGION || ""}
                      onChange={(e) => updateField("AWS_REGION", e.target.value)}
                      className="input-field font-mono text-sm"
                      placeholder="auto"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Access Key</label>
                    <input
                      type="password"
                      value={values.S3_ACCESS_KEY || ""}
                      onChange={(e) => updateField("S3_ACCESS_KEY", e.target.value)}
                      className="input-field font-mono text-sm"
                      placeholder="your-access-key"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Secret Key</label>
                    <input
                      type="password"
                      value={values.S3_SECRET_KEY || ""}
                      onChange={(e) => updateField("S3_SECRET_KEY", e.target.value)}
                      className="input-field font-mono text-sm"
                      placeholder="your-secret-key"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Bucket Name</label>
                    <input
                      type="text"
                      value={values.S3_BUCKET || ""}
                      onChange={(e) => updateField("S3_BUCKET", e.target.value)}
                      className="input-field font-mono text-sm"
                      placeholder="sonara-tracks"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={async () => {
                        setSaving((prev) => ({ ...prev, s3: true }));
                        const s3Fields = ["S3_ENDPOINT", "AWS_REGION", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET"];
                        for (const key of s3Fields) {
                          await fetch("/api/settings", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ key, value: values[key] || "" }),
                          });
                        }
                        setSaving((prev) => ({ ...prev, s3: false }));
                      }}
                      disabled={saving.s3}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      {saving.s3 ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => testS3()}
                      disabled={testingS3}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      {testingS3 ? "Testing..." : "Test Connection"}
                    </button>
                  </div>
                  {s3Status && (
                    <p className={`text-xs ${s3Status.connected ? "text-green-400" : "text-red-400"}`}>
                      {s3Status.message}
                    </p>
                  )}
                  {s3Stats && (
                    <div className="mt-3 p-2 bg-white/5 rounded border border-white/10">
                      <div className="text-xs space-y-1">
                        <p className="text-white/60">
                          <span className="text-white/40">Total Size:</span> <span className="text-white/80 font-mono">{s3Stats.formattedSize}</span>
                        </p>
                        <p className="text-white/60">
                          <span className="text-white/40">Objects:</span> <span className="text-white/80 font-mono">{s3Stats.objectCount.toLocaleString()}</span>
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => fetchS3Stats()}
                      disabled={loadingS3Stats}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      {loadingS3Stats ? "Loading..." : "Refresh Storage Stats"}
                    </button>
                  </div>
                </div>
              </section>

              <ApiLoggingCard
                enabled={values.ENABLE_API_LOGGING === "true"}
                saving={Boolean(saving.apiLogging)}
                onToggle={() =>
                  updateField(
                    "ENABLE_API_LOGGING",
                    values.ENABLE_API_LOGGING === "true" ? "false" : "true"
                  )
                }
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
