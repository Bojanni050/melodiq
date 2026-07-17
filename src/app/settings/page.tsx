"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import AiRoutingSection from "@/components/settings/AiRoutingSection";
import ApiLoggingCard from "@/components/settings/ApiLoggingCard";
import CoverArtSection from "@/components/settings/CoverArtSection";
import MinimaxSection from "@/components/settings/MinimaxSection";
import ModelDetailModal from "@/components/settings/ModelDetailModal";
import MusicGptRecoverySection from "@/components/settings/MusicGptRecoverySection";
import WavRecoverySection from "@/components/settings/WavRecoverySection";
import ProviderSection from "@/components/settings/ProviderSection";
import PushNotificationsSection from "@/components/settings/PushNotificationsSection";
import { SettingsSidebar, ProvidersTabBar, SettingsSectionId, ProvidersTabId } from "@/components/settings/SettingsNav";
import UnsavedChangesBar from "@/components/settings/UnsavedChangesBar";
import VisualizerSection from "@/components/settings/VisualizerSection";
import S3Section from "@/components/settings/S3Section";
import WebhooksSection from "@/components/settings/WebhooksSection";
import { PROVIDERS, WEBHOOK_DEFAULTS } from "@/lib/settings-constants";
import { usePlayerStore } from "@/lib/store";
import { applyWebhookDefaults, buildWebhookUrl, createModelPlaceholder, LLMModel } from "@/lib/settings-utils";

const TRACKED_SETTINGS_KEYS = [
  ...PROVIDERS.flatMap((p) => p.fields.map((f) => f.key)),
  "OPENROUTER_PROMPT_MODEL",
  "OPENROUTER_LYRICS_MODEL",
  "OPENROUTER_IMAGE_MODEL",
  "PROMPT_LLM_PROVIDER",
  "LYRICS_LLM_PROVIDER",
  "PIXAZO_API_KEY",
  "APP_URL",
  "POYO_WEBHOOK_URL",
  "POYO_WAV_WEBHOOK_URL",
  "TEMPOLOR_WEBHOOK_URL",
  "MUSICGPT_WEBHOOK_URL",
  "MINIMAX_WEBHOOK_URL",
  "APIFRAME_WEBHOOK_URL",
  "S3_ENDPOINT",
  "AWS_REGION",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "S3_BUCKET",
];

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(precision)} ${units[index]}`;
}

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [savedValues, setSavedValues] = useState<Record<string, string>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("providers");
  const [activeProvidersTab, setActiveProvidersTab] = useState<ProvidersTabId>("music");
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
  const [importSourceUrl, setImportSourceUrl] = useState("");
  const [importSourceEmail, setImportSourceEmail] = useState("");
  const [importSqlFile, setImportSqlFile] = useState<File | null>(null);
  const [importingData, setImportingData] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const { playHighestQuality, setPlayHighestQuality } = usePlayerStore();

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
        const withWebhookDefaults = applyWebhookDefaults(settings);
        setValues(withWebhookDefaults);
        setSavedValues(withWebhookDefaults);
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

  async function toggleApiLogging() {
    const next = values.ENABLE_API_LOGGING === "true" ? "false" : "true";
    setValues((prev) => ({ ...prev, ENABLE_API_LOGGING: next }));
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "ENABLE_API_LOGGING", value: next }),
    });
  }

  const dirtyKeys = TRACKED_SETTINGS_KEYS.filter((key) => (values[key] ?? "") !== (savedValues[key] ?? ""));

  async function saveAllChanges() {
    setSavingAll(true);
    setSaveError(null);
    const appUrl = values.APP_URL?.trim();
    const succeeded: Record<string, string> = {};
    try {
      for (const key of dirtyKeys) {
        let value = values[key] ?? "";
        if (!value && appUrl && key.endsWith("_WEBHOOK_URL")) {
          const def = WEBHOOK_DEFAULTS.find((d) => d.key === key);
          if (def) value = buildWebhookUrl(appUrl, def.path);
        }
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
        });
        if (!res.ok) {
          setSaveError(
            res.status === 401
              ? "Your session has expired. Log in again and retry saving."
              : "Failed to save changes. Please retry."
          );
          break;
        }
        succeeded[key] = value;
      }
    } catch {
      setSaveError("Network error — could not reach the server.");
    } finally {
      if (Object.keys(succeeded).length > 0) {
        setSavedValues((prev) => ({ ...prev, ...succeeded }));
      }
      setSavingAll(false);
    }
  }

  function discardChanges() {
    setValues(savedValues);
    setSaveError(null);
  }

  async function runImport() {
    if (importingData) return;
    const sourceDatabaseUrl = importSourceUrl.trim();
    if (!sourceDatabaseUrl) {
      setImportNotice("Source DATABASE_URL is required.");
      return;
    }

    const confirmed = window.confirm(
      "Import data from another database for your account?\n\nThis will copy tracks and workspaces. Audio files are not copied (S3 keys are reused)."
    );
    if (!confirmed) return;

    setImportingData(true);
    setImportNotice(null);
    try {
      const res = await fetch("/api/settings/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceDatabaseUrl,
          sourceEmail: importSourceEmail.trim() || undefined,
        }),
      });
      const data = await res.json().catch((error) => {
        console.error("Import: failed to parse response JSON:", error);
        return {};
      });
      if (!res.ok) {
        setImportNotice(data?.error || "Import failed.");
        return;
      }
      const importedTracks = typeof data?.importedTracks === "number" ? data.importedTracks : 0;
      const importedWorkspaces = typeof data?.importedWorkspaces === "number" ? data.importedWorkspaces : 0;
      setImportNotice(`Imported ${importedTracks} track(s) and ${importedWorkspaces} workspace(s). Refresh Library to see them.`);
    } catch (error) {
      console.error("Import: request failed:", error);
      setImportNotice("Import failed.");
    } finally {
      setImportingData(false);
    }
  }

  async function runImportSql() {
    if (importingData) return;
    if (!importSqlFile) {
      setImportNotice("SQL file is required.");
      return;
    }

    const confirmed = window.confirm(
      "Import data from a SQL file for your account?\n\nThis expects a pg_dump plain SQL file with COPY blocks. This will copy tracks and workspaces. Audio files are not copied (S3 keys are reused)."
    );
    if (!confirmed) return;

    setImportingData(true);
    setImportNotice(null);
    try {
      const form = new FormData();
      form.set("sqlFile", importSqlFile);
      if (importSourceEmail.trim()) form.set("sourceEmail", importSourceEmail.trim());

      const res = await fetch("/api/settings/import", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch((error) => {
        console.error("Import (SQL): failed to parse response JSON:", error);
        return {};
      });
      if (!res.ok) {
        setImportNotice(data?.error || "Import failed.");
        return;
      }
      const importedTracks = typeof data?.importedTracks === "number" ? data.importedTracks : 0;
      const importedWorkspaces = typeof data?.importedWorkspaces === "number" ? data.importedWorkspaces : 0;
      setImportNotice(`Imported ${importedTracks} track(s) and ${importedWorkspaces} workspace(s). Refresh Library to see them.`);
    } catch (error) {
      console.error("Import (SQL): request failed:", error);
      setImportNotice("Import failed.");
    } finally {
      setImportingData(false);
    }
  }

  const filteredModels = modelSearchQuery
    ? allModels.filter((m) => m.id.toLowerCase().includes(modelSearchQuery.toLowerCase()) || m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()))
    : allModels;

  const musicProviders = PROVIDERS.filter((p) => ["lyria", "poyo", "tempolor", "musicgpt", "mureka", "apiframe"].includes(p.id));
  const llmProviders = PROVIDERS.filter((p) => ["openrouter", "openai"].includes(p.id));
  const openrouterProvider = llmProviders.find((p) => p.id === "openrouter")!;
  const openaiProvider = llmProviders.find((p) => p.id === "openai")!;
  const diskCacheSizeBytes = Number(values.DISK_CACHE_SIZE_BYTES || "0");

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
          <div className="flex flex-col lg:flex-row gap-6 max-w-5xl">
            <SettingsSidebar active={activeSection} onChange={setActiveSection} />

            <div className="flex-1 min-w-0 max-w-3xl">
              {activeSection === "providers" && (
                <>
                  <ProvidersTabBar active={activeProvidersTab} onChange={setActiveProvidersTab} />

                  {activeProvidersTab === "music" && (
                    <div className="space-y-3">
                      {musicProviders.map((provider) => (
                        <ProviderSection key={provider.id} provider={provider} values={values} onFieldChange={updateField} />
                      ))}
                      <MinimaxSection values={values} onFieldChange={updateField} />
                      <WebhooksSection values={values} onFieldChange={updateField} />
                    </div>
                  )}

                  {activeProvidersTab === "llm" && (
                    <div className="space-y-3">
                      <ProviderSection
                        provider={openrouterProvider}
                        values={values}
                        onFieldChange={updateField}
                        onGetModels={getOpenRouterModels}
                        testingModels={testingModels}
                      />
                      <ProviderSection provider={openaiProvider} values={values} onFieldChange={updateField} />
                    </div>
                  )}

                  {activeProvidersTab === "images" && (
                    <div className="space-y-3">
                      <CoverArtSection value={values.PIXAZO_API_KEY ?? ""} onChange={(v) => updateField("PIXAZO_API_KEY", v)} />
                    </div>
                  )}
                </>
              )}

              {activeSection === "ai-routing" && (
                <AiRoutingSection
                  values={values}
                  onFieldChange={updateField}
                  allModels={allModels}
                  filteredModels={filteredModels}
                  modelSearchQuery={modelSearchQuery}
                  selectedPromptModel={selectedPromptModel}
                  selectedLyricsModel={selectedLyricsModel}
                  selectedImageModel={selectedImageModel}
                  showPromptDropdown={showPromptModelDropdown}
                  showLyricsDropdown={showLyricsModelDropdown}
                  showImageDropdown={showImageModelDropdown}
                  onSearchQueryChange={setModelSearchQuery}
                  onPromptModelSelect={selectPromptModel}
                  onLyricsModelSelect={selectLyricsModel}
                  onImageModelSelect={selectImageModel}
                  onTogglePromptDropdown={() => { setShowPromptModelDropdown((v) => !v); setShowLyricsModelDropdown(false); setShowImageModelDropdown(false); }}
                  onToggleLyricsDropdown={() => { setShowLyricsModelDropdown((v) => !v); setShowPromptModelDropdown(false); setShowImageModelDropdown(false); }}
                  onToggleImageDropdown={() => { setShowImageModelDropdown((v) => !v); setShowPromptModelDropdown(false); setShowLyricsModelDropdown(false); }}
                  onReadMore={setModelDetail}
                />
              )}

              {activeSection === "storage" && (
                <div className="space-y-3">
                  <section className="section-card">
                    <h2 className="text-sm font-semibold mb-1">Disk Cache</h2>
                    <p className="text-xs text-white/40 mb-2">Current size of the local Next.js disk cache folder.</p>
                    <p className="text-base font-semibold text-white/90">{formatBytes(diskCacheSizeBytes)}</p>
                  </section>

                  <div className="bg-white/5 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-white">ffmpeg</p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {values.FFMPEG_AVAILABLE === "true"
                          ? "WAV uploads are automatically converted to FLAC."
                          : "WAV uploads are stored as-is. Install ffmpeg to enable FLAC conversion."}
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                      values.FFMPEG_AVAILABLE === "true"
                        ? "bg-green-500/15 text-green-400"
                        : "bg-red-500/15 text-red-400"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${values.FFMPEG_AVAILABLE === "true" ? "bg-green-400" : "bg-red-400"}`} />
                      {values.FFMPEG_AVAILABLE === "true" ? "Installed" : "Not found"}
                    </span>
                  </div>
                </div>
              )}

              {activeSection === "playback" && (
                <div className="space-y-3">
                  <section className="section-card">
                    <h2 className="text-sm font-semibold mb-1">Playback Quality</h2>
                    <p className="text-xs text-white/40 mb-3">
                      When enabled, FLAC is preferred over WAV, then MP3 as fallback. Off always uses MP3 when available.
                    </p>
                    <label className="flex items-center justify-between gap-3">
                      <span className="text-xs text-white/70">Play highest quality</span>
                      <button
                        type="button"
                        aria-label="Toggle highest quality playback"
                        onClick={() => setPlayHighestQuality(!playHighestQuality)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          playHighestQuality ? "bg-emerald-500/20" : "bg-white/10"
                        }`}
                      >
                        <span className="sr-only">Play highest quality</span>
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                            playHighestQuality ? "translate-x-6" : ""
                          }`}
                        />
                      </button>
                    </label>
                  </section>

                  <VisualizerSection />

                  <PushNotificationsSection />
                </div>
              )}

              {activeSection === "data" && (
                <div className="space-y-4">
                  <section className="section-card">
                    <h2 className="text-sm font-semibold mb-3">Export</h2>
                    <p className="text-xs text-white/40 mb-3">
                      Download your track listing or a full database backup.
                    </p>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-white/60 font-medium mb-1.5">Track listing</p>
                        <div className="flex items-center gap-2">
                          <a
                            href="/api/export/tracks?format=csv"
                            download
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
                          >
                            Export CSV
                          </a>
                          <a
                            href="/api/export/tracks?format=json"
                            download
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
                          >
                            Export JSON
                          </a>
                        </div>
                      </div>
                      <div className="h-px bg-white/10" />
                      <div>
                        <p className="text-xs text-white/60 font-medium mb-1.5">Database backup</p>
                        <p className="text-xs text-white/30 mb-2">
                          Volledig JSON backup — tracks, workspaces, playlists en volgorde.
                        </p>
                        <a
                          href="/api/export/db"
                          download
                          className="inline-block rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
                        >
                          Download backup
                        </a>
                      </div>
                    </div>
                  </section>

                  <section className="section-card">
                    <h2 className="text-sm font-semibold mb-2">Import Data</h2>
                    <p className="text-xs text-white/40 mb-3">
                      Import tracks and workspaces from another MelodIQ/MelodIQ PostgreSQL database.
                    </p>
                    <div className="space-y-2">
                      <input
                        type="password"
                        value={importSourceUrl}
                        onChange={(e) => setImportSourceUrl(e.target.value)}
                        placeholder="Source DATABASE_URL (postgres://...)"
                        className="input-field text-sm"
                      />
                      <input
                        type="text"
                        value={importSourceEmail}
                        onChange={(e) => setImportSourceEmail(e.target.value)}
                        placeholder="Source email (optional, defaults to your account email)"
                        className="input-field text-sm"
                      />
                      <div className="h-px bg-white/10" />
                      <input
                        type="file"
                        accept=".sql,.txt"
                        onChange={(e) => setImportSqlFile(e.target.files?.[0] ?? null)}
                        className="block w-full text-xs text-white/70 file:mr-3 file:rounded-lg file:border file:border-white/10 file:bg-white/5 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white/70 hover:file:bg-white/10"
                      />
                      {importSqlFile ? <p className="text-xs text-white/40">Selected: {importSqlFile.name}</p> : null}
                      {importNotice ? <p className="text-xs text-white/50">{importNotice}</p> : null}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={runImport}
                          disabled={importingData}
                          className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {importingData ? "Importing..." : "Import"}
                        </button>
                        <button
                          type="button"
                          onClick={runImportSql}
                          disabled={importingData}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {importingData ? "Importing..." : "Import SQL"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setImportSourceUrl("");
                            setImportSourceEmail("");
                            setImportSqlFile(null);
                            setImportNotice(null);
                          }}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </section>

                  <ApiLoggingCard enabled={values.ENABLE_API_LOGGING === "true"} onToggle={toggleApiLogging} />
                </div>
              )}

              {activeSection === "advanced" && (
                <div className="space-y-3">
                  <S3Section values={values} onFieldChange={updateField} />
                  <MusicGptRecoverySection />
                  <WavRecoverySection />
                </div>
              )}
            </div>
          </div>

          <UnsavedChangesBar
            count={dirtyKeys.length}
            saving={savingAll}
            error={saveError}
            onSave={saveAllChanges}
            onDiscard={discardChanges}
          />
        </main>
      </div>

      <ModelDetailModal modelDetail={modelDetail} onClose={() => setModelDetail(null)} />
    </div>
  );
}
