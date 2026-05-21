"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  fields: Array<{
    key: string;
    label: string;
    type: "password" | "text";
    placeholder: string;
  }>;
  testEndpoint: string;
}

interface LLMModel {
  id: string;
  name: string;
  description: string;
  pricing: {
    prompt: string | number;
    completion: string | number;
  };
  context_length: number;
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type: string;
  };
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "lyria",
    name: "Google Lyria 3",
    description: "Synchronous music generation provider",
    fields: [
      {
        key: "LYRIA_API_KEY",
        label: "API Key",
        type: "password",
        placeholder: "lyria_...",
      },
    ],
    testEndpoint: "lyria",
  },
  {
    id: "poyo",
    name: "PoYo (Suno)",
    description: "Async music generation with webhook support",
    fields: [
      {
        key: "POYO_API_KEY",
        label: "API Key",
        type: "password",
        placeholder: "poyo_...",
      },
    ],
    testEndpoint: "poyo",
  },
  {
    id: "tempolor",
    name: "Tempolor",
    description: "Async music generation with HD output",
    fields: [
      {
        key: "TEMPOLOR_API_KEY",
        label: "API Key",
        type: "password",
        placeholder: "tempolor_...",
      },
    ],
    testEndpoint: "tempolor",
  },
  {
    id: "musicgpt",
    name: "MusicGPT",
    description: "Async music generation with AI voice models",
    fields: [
      {
        key: "MUSICGPT_API_KEY",
        label: "API Key",
        type: "password",
        placeholder: "musicgpt_...",
      },
    ],
    testEndpoint: "musicgpt",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Primary LLM provider for prompt optimization and lyrics",
    fields: [
      {
        key: "OPENROUTER_API_KEY",
        label: "API Key",
        type: "password",
        placeholder: "sk-or-...",
      },
    ],
    testEndpoint: "openrouter",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "Fallback LLM provider",
    fields: [
      {
        key: "OPENAI_API_KEY",
        label: "API Key",
        type: "password",
        placeholder: "sk-...",
      },
      {
        key: "OPENAI_PROMPT_MODEL",
        label: "Prompt Model",
        type: "text",
        placeholder: "gpt-4o",
      },
      {
        key: "OPENAI_LYRICS_MODEL",
        label: "Lyrics Model",
        type: "text",
        placeholder: "gpt-4o",
      },
    ],
    testEndpoint: "openai",
  },
];

function formatPrice(price: string | number): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (!num || num === 0) return "Free";
  if (num >= 1) return `$${num.toFixed(2)}/1M tokens`;
  return `$${(num * 1_000_000).toFixed(2)}/1M tokens`;
}

function truncateDescription(text: string, maxLines: number = 3): { text: string; truncated: boolean } {
  if (!text) return { text: "", truncated: false };
  const words = text.split(" ");
  const maxWords = maxLines * 12;
  if (words.length <= maxWords) {
    return { text, truncated: false };
  }
  return { text: words.slice(0, maxWords).join(" ") + "...", truncated: true };
}

function createModelPlaceholder(id: string): LLMModel {
  return {
    id,
    name: id,
    description: "",
    pricing: { prompt: "0", completion: "0" },
    context_length: 0,
    architecture: { modality: "", tokenizer: "", instruct_type: "" },
  };
}

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

        setValues(settings);
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
    setValues((prev) => ({ ...prev, [key]: value }));
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

    const webhookFields = [
      "APP_URL",
      "POYO_WEBHOOK_URL",
      "POYO_WAV_WEBHOOK_URL",
      "TEMPOLOR_WEBHOOK_URL",
      "MUSICGPT_WEBHOOK_URL",
      "MINIMAX_WEBHOOK_URL",
    ];

    for (const key of webhookFields) {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: values[key] || "" }),
      });
    }

    setSaving((prev) => ({ ...prev, webhooks: false }));
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
          <div className="absolute z-50 mt-1 w-full max-h-96 overflow-y-auto bg-[#1a1a24] border border-white/10 rounded-lg shadow-xl">
            <div className="p-2">
              <input
                type="text"
                placeholder="Search models..."
                value={modelSearchQuery}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm placeholder-white/30 focus:outline-none focus:border-primary-500"
                onChange={(e) => setModelSearchQuery(e.target.value)}
              />
            </div>
            {filteredModels.map((model) => {
              const { text, truncated } = truncateDescription(model.description, 3);
              const isSelected = selected?.id === model.id;
              return (
                <div
                  key={model.id}
                  className={`px-4 py-3 border-b border-white/5 last:border-b-0 hover:bg-white/5 cursor-pointer ${
                    isSelected ? "bg-primary-500/10" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{model.name}</p>
                      <p className="text-xs text-white/40 line-clamp-3 mt-0.5">
                        {text}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-white/30">
                        <span>Prompt: {formatPrice(model.pricing.prompt)}</span>
                        <span>Completion: {formatPrice(model.pricing.completion)}</span>
                        {model.context_length && (
                          <span>Context: {model.context_length.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {truncated && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModelDetail(model);
                          }}
                          className="text-xs text-primary-400 hover:text-primary-300 whitespace-nowrap"
                        >
                          Read more
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onSelect(model)}
                        className={`text-xs px-2 py-1 rounded ${
                          isSelected
                            ? "bg-primary-500 text-white"
                            : "bg-white/10 text-white/50 hover:bg-white/20"
                        }`}
                      >
                        {isSelected ? "Selected" : "Select"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderProviderSection(provider: ProviderConfig) {
    return (
      <section key={provider.id} className="section-card">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">{provider.name}</h2>
          <p className="text-xs text-white/30">{provider.description}</p>
        </div>

        <div className="space-y-3">
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

          {provider.id === "openrouter" && (
            <div className="relative">
              <label className="block text-xs font-medium text-white/50 mb-1">Prompt Model</label>
              {allModels.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowPromptModelDropdown(!showPromptModelDropdown);
                    setShowImageModelDropdown(false);
                    setShowLyricsModelDropdown(false);
                  }}
                  className="w-full input-field font-mono text-sm text-left flex items-center justify-between"
                >
                  <span className="truncate">
                    {selectedPromptModel ? selectedPromptModel.name : "Select a model..."}
                  </span>
                  <svg className={`w-4 h-4 transition-transform ${showPromptModelDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              ) : (
                <div className="input-field font-mono text-sm text-white/60">
                  {selectedPromptModel ? selectedPromptModel.name : "Retrieve models to select"}
                </div>
              )}

              {showPromptModelDropdown && filteredModels.length > 0 && (
                <div className="absolute z-50 mt-1 w-full max-h-96 overflow-y-auto bg-[#1a1a24] border border-white/10 rounded-lg shadow-xl">
                  <div className="p-2">
                    <input
                      type="text"
                      placeholder="Search models..."
                      value={modelSearchQuery}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm placeholder-white/30 focus:outline-none focus:border-primary-500"
                      onChange={(e) => setModelSearchQuery(e.target.value)}
                    />
                  </div>
                  {filteredModels.map((model) => {
                    const { text, truncated } = truncateDescription(model.description, 3);
                    const isSelected = selectedPromptModel?.id === model.id;
                    return (
                      <div
                        key={model.id}
                        className={`px-4 py-3 border-b border-white/5 last:border-b-0 hover:bg-white/5 cursor-pointer ${
                          isSelected ? "bg-primary-500/10" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white">{model.name}</p>
                            <p className="text-xs text-white/40 line-clamp-3 mt-0.5">
                              {text}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-white/30">
                              <span>Prompt: {formatPrice(model.pricing.prompt)}</span>
                              <span>Completion: {formatPrice(model.pricing.completion)}</span>
                              {model.context_length && (
                                <span>Context: {model.context_length.toLocaleString()}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {truncated && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModelDetail(model);
                                }}
                                className="text-xs text-primary-400 hover:text-primary-300 whitespace-nowrap"
                              >
                                Read more
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => selectPromptModel(model)}
                              className={`text-xs px-2 py-1 rounded ${
                                isSelected
                                  ? "bg-primary-500 text-white"
                                  : "bg-white/10 text-white/50 hover:bg-white/20"
                              }`}
                            >
                              {isSelected ? "Selected" : "Select"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {provider.id === "openrouter" && (
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
            })
          )}

          {provider.id === "openrouter" && (
            <div className="relative">
              <label className="block text-xs font-medium text-white/50 mb-1">Image Prompt Model</label>
              {allModels.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowImageModelDropdown(!showImageModelDropdown);
                    setShowPromptModelDropdown(false);
                    setShowLyricsModelDropdown(false);
                  }}
                  className="w-full input-field font-mono text-sm text-left flex items-center justify-between"
                >
                  <span className="truncate">
                    {selectedImageModel ? selectedImageModel.name : "Select a model..."}
                  </span>
                  <svg className={`w-4 h-4 transition-transform ${showImageModelDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              ) : (
                <div className="input-field font-mono text-sm text-white/60">
                  {selectedImageModel ? selectedImageModel.name : "Retrieve models to select"}
                </div>
              )}

              {showImageModelDropdown && filteredModels.length > 0 && (
                <div className="absolute z-50 mt-1 w-full max-h-96 overflow-y-auto bg-[#1a1a24] border border-white/10 rounded-lg shadow-xl">
                  <div className="p-2">
                    <input
                      type="text"
                      placeholder="Search models..."
                      value={modelSearchQuery}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm placeholder-white/30 focus:outline-none focus:border-primary-500"
                      onChange={(e) => setModelSearchQuery(e.target.value)}
                    />
                  </div>
                  {filteredModels.map((model) => {
                    const { text, truncated } = truncateDescription(model.description, 3);
                    const isSelected = selectedImageModel?.id === model.id;
                    return (
                      <div
                        key={model.id}
                        className={`px-4 py-3 border-b border-white/5 last:border-b-0 hover:bg-white/5 cursor-pointer ${
                          isSelected ? "bg-primary-500/10" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white">{model.name}</p>
                            <p className="text-xs text-white/40 line-clamp-3 mt-0.5">
                              {text}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-white/30">
                              <span>Prompt: {formatPrice(model.pricing.prompt)}</span>
                              <span>Completion: {formatPrice(model.pricing.completion)}</span>
                              {model.context_length && (
                                <span>Context: {model.context_length.toLocaleString()}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {truncated && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModelDetail(model);
                                }}
                                className="text-xs text-primary-400 hover:text-primary-300 whitespace-nowrap"
                              >
                                Read more
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => selectImageModel(model)}
                              className={`text-xs px-2 py-1 rounded ${
                                isSelected
                                  ? "bg-primary-500 text-white"
                                  : "bg-white/10 text-white/50 hover:bg-white/20"
                              }`}
                            >
                              {isSelected ? "Selected" : "Select"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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
        </div>
      </section>
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
    <div className="min-h-screen bg-[#0a0a0f]">
      <Sidebar credits={null} />
      <div className="lg:ml-[240px]">
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
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">PoYo Webhook URL</label>
                    <input
                      type="text"
                      value={values.POYO_WEBHOOK_URL || ""}
                      onChange={(e) => updateField("POYO_WEBHOOK_URL", e.target.value)}
                      className="input-field font-mono text-sm"
                      placeholder={values.APP_URL ? `${values.APP_URL.replace(/\/$/, "")}/api/webhooks/poyo` : "Leave empty to auto-derive"}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">PoYo WAV Webhook URL</label>
                    <input
                      type="text"
                      value={values.POYO_WAV_WEBHOOK_URL || ""}
                      onChange={(e) => updateField("POYO_WAV_WEBHOOK_URL", e.target.value)}
                      className="input-field font-mono text-sm"
                      placeholder={values.APP_URL ? `${values.APP_URL.replace(/\/$/, "")}/api/webhooks/poyo-wav` : "Leave empty to auto-derive"}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Tempolor Webhook URL</label>
                    <input
                      type="text"
                      value={values.TEMPOLOR_WEBHOOK_URL || ""}
                      onChange={(e) => updateField("TEMPOLOR_WEBHOOK_URL", e.target.value)}
                      className="input-field font-mono text-sm"
                      placeholder={values.APP_URL ? `${values.APP_URL.replace(/\/$/, "")}/api/webhooks/tempolor` : "Leave empty to auto-derive"}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">MusicGPT Webhook URL</label>
                    <input
                      type="text"
                      value={values.MUSICGPT_WEBHOOK_URL || ""}
                      onChange={(e) => updateField("MUSICGPT_WEBHOOK_URL", e.target.value)}
                      className="input-field font-mono text-sm"
                      placeholder={values.APP_URL ? `${values.APP_URL.replace(/\/$/, "")}/api/webhooks/musicgpt` : "Leave empty to auto-derive"}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">MiniMax Webhook URL</label>
                    <input
                      type="text"
                      value={values.MINIMAX_WEBHOOK_URL || ""}
                      onChange={(e) => updateField("MINIMAX_WEBHOOK_URL", e.target.value)}
                      className="input-field font-mono text-sm"
                      placeholder={values.APP_URL ? `${values.APP_URL.replace(/\/$/, "")}/api/webhooks/minimax` : "Leave empty to auto-derive"}
                    />
                  </div>
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

              <section className="section-card">
                <h2 className="text-sm font-semibold mb-3">API Logging</h2>
                <p className="text-xs text-white/40 mb-3">
                  Store provider requests and responses in Logs for debugging.
                </p>
                <div className="space-y-3">
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-xs text-white/70">Enable API logging</span>
                    <button
                      type="button"
                      aria-pressed={values.ENABLE_API_LOGGING === "true"}
                      onClick={() =>
                        updateField(
                          "ENABLE_API_LOGGING",
                          values.ENABLE_API_LOGGING === "true" ? "false" : "true"
                        )
                      }
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        values.ENABLE_API_LOGGING === "true"
                          ? "bg-emerald-500/20"
                          : "bg-white/10"
                      }`}
                    >
                      <span className="sr-only">Enable API logging</span>
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                          values.ENABLE_API_LOGGING === "true" ? "translate-x-6" : ""
                        }`}
                      />
                    </button>
                  </label>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => saveApiLogging()}
                      disabled={saving.apiLogging}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      {saving.apiLogging ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </section>
            </div>

          </div>
        </main>
      </div>

      {modelDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setModelDetail(null)}
        >
          <div
            className="bg-[#1a1a24] border border-white/10 rounded-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-bold">{modelDetail.name}</h3>
                <button
                  onClick={() => setModelDetail(null)}
                  className="text-white/50 hover:text-white text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-medium text-white/40 mb-1">ID</h4>
                  <p className="font-mono text-sm">{modelDetail.id}</p>
                </div>

                {modelDetail.description && (
                  <div>
                    <h4 className="text-xs font-medium text-white/40 mb-1">Description</h4>
                    <p className="text-sm leading-relaxed text-white/70">{modelDetail.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-medium text-white/40 mb-1">Prompt Price</h4>
                    <p className="text-sm text-white/60">{formatPrice(modelDetail.pricing.prompt)}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-white/40 mb-1">Completion Price</h4>
                    <p className="text-sm text-white/60">{formatPrice(modelDetail.pricing.completion)}</p>
                  </div>
                  {modelDetail.context_length && (
                    <div>
                      <h4 className="text-xs font-medium text-white/40 mb-1">Context Length</h4>
                      <p className="text-sm text-white/60">{modelDetail.context_length.toLocaleString()} tokens</p>
                    </div>
                  )}
                  {modelDetail.architecture?.modality && (
                    <div>
                      <h4 className="text-xs font-medium text-white/40 mb-1">Modality</h4>
                      <p className="text-sm text-white/60">{modelDetail.architecture.modality}</p>
                    </div>
                  )}
                  {modelDetail.architecture?.tokenizer && (
                    <div>
                      <h4 className="text-xs font-medium text-white/40 mb-1">Tokenizer</h4>
                      <p className="text-sm text-white/60">{modelDetail.architecture.tokenizer}</p>
                    </div>
                  )}
                  {modelDetail.architecture?.instruct_type && (
                    <div>
                      <h4 className="text-xs font-medium text-white/40 mb-1">Instruct Type</h4>
                      <p className="text-sm text-white/60">{modelDetail.architecture.instruct_type}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
