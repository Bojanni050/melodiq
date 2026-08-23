"use client";

import type { ReactNode } from "react";
import OpenRouterModelDropdown from "@/components/settings/OpenRouterModelDropdown";
import type { LLMModel } from "@/lib/settings-utils";

// The OpenRouterModelDropdown fetches its option list from OpenRouter's own
// /models endpoint, so it only ever makes sense — and only ever writes the
// right setting key — when that purpose's provider is actually "openrouter".
// When OpenAI or Eden AI is selected instead, fall back to a plain text
// field bound to that provider's own model setting (e.g. OPENAI_PROMPT_MODEL
// / EDENAI_PROMPT_MODEL), matching the fields already in their Settings
// sections, rather than silently showing/editing OpenRouter models for a
// purpose that isn't routed to OpenRouter.
function ModelField({
  label,
  provider,
  openAiKey,
  values,
  onFieldChange,
  openRouterDropdown,
  edenAiDropdown,
}: {
  label: string;
  provider: string;
  openAiKey: string;
  values: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  openRouterDropdown: ReactNode;
  edenAiDropdown: ReactNode;
}) {
  if (provider === "openai") {
    return (
      <div>
        <label className="block text-sm font-medium text-white/50 mb-1">{label} (OpenAI)</label>
        <input
          type="text"
          value={values[openAiKey] || ""}
          onChange={(e) => onFieldChange(openAiKey, e.target.value)}
          placeholder="gpt-4o"
          className="input-field font-mono text-sm"
        />
      </div>
    );
  }

  if (provider === "edenai") {
    return <>{edenAiDropdown}</>;
  }

  return <>{openRouterDropdown}</>;
}

export default function AiRoutingSection({
  values,
  onFieldChange,
  allModels,
  filteredModels,
  edenAiModels,
  filteredEdenAiModels,
  filteredModelsForAdvancedDna,
  filteredEdenAiModelsForAdvancedDna,
  modelSearchQuery,
  selectedPromptModel,
  selectedLyricsModel,
  selectedImageModel,
  selectedTrackDnaModel,
  showPromptDropdown,
  showLyricsDropdown,
  showImageDropdown,
  showTrackDnaDropdown,
  onSearchQueryChange,
  onPromptModelSelect,
  onLyricsModelSelect,
  onImageModelSelect,
  onTrackDnaModelSelect,
  onTogglePromptDropdown,
  onToggleLyricsDropdown,
  onToggleImageDropdown,
  onToggleTrackDnaDropdown,
  selectedAdvancedDnaModel,
  showAdvancedDnaDropdown,
  onAdvancedDnaModelSelect,
  onToggleAdvancedDnaDropdown,
  selectedLyricIqModel,
  showLyricIqDropdown,
  onLyricIqModelSelect,
  onToggleLyricIqDropdown,
  selectedTimecodedModel,
  showTimecodedDropdown,
  onTimecodedModelSelect,
  onToggleTimecodedDropdown,
  isAdmin,
  onReadMore,
  autoAnalyzeComposition,
  onToggleAutoAnalyzeComposition,
  tclAutoJumpToEditor,
  onToggleTclAutoJumpToEditor,
  onGetModels,
  testingModels,
}: {
  values: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  allModels: LLMModel[];
  filteredModels: LLMModel[];
  edenAiModels: LLMModel[];
  filteredEdenAiModels: LLMModel[];
  filteredModelsForAdvancedDna: LLMModel[];
  filteredEdenAiModelsForAdvancedDna: LLMModel[];
  modelSearchQuery: string;
  selectedPromptModel: LLMModel | null;
  selectedLyricsModel: LLMModel | null;
  selectedImageModel: LLMModel | null;
  selectedTrackDnaModel: LLMModel | null;
  showPromptDropdown: boolean;
  showLyricsDropdown: boolean;
  showImageDropdown: boolean;
  showTrackDnaDropdown: boolean;
  selectedAdvancedDnaModel: LLMModel | null;
  showAdvancedDnaDropdown: boolean;
  selectedLyricIqModel: LLMModel | null;
  showLyricIqDropdown: boolean;
  selectedTimecodedModel?: LLMModel | null;
  showTimecodedDropdown?: boolean;
  onSearchQueryChange: (query: string) => void;
  onPromptModelSelect: (model: LLMModel) => void;
  onLyricsModelSelect: (model: LLMModel) => void;
  onImageModelSelect: (model: LLMModel) => void;
  onTrackDnaModelSelect: (model: LLMModel) => void;
  onTogglePromptDropdown: () => void;
  onToggleLyricsDropdown: () => void;
  onToggleImageDropdown: () => void;
  onToggleTrackDnaDropdown: () => void;
  onAdvancedDnaModelSelect: (model: LLMModel) => void;
  onToggleAdvancedDnaDropdown: () => void;
  onLyricIqModelSelect: (model: LLMModel) => void;
  onToggleLyricIqDropdown: () => void;
  onTimecodedModelSelect?: (model: LLMModel) => void;
  onToggleTimecodedDropdown?: () => void;
  isAdmin?: boolean;
  onReadMore: (model: LLMModel) => void;
  autoAnalyzeComposition: boolean;
  onToggleAutoAnalyzeComposition: () => void;
  tclAutoJumpToEditor: boolean;
  onToggleTclAutoJumpToEditor: () => void;
  onGetModels?: () => void;
  testingModels?: boolean;
}) {
  return (
    <div className="space-y-4">
      <section className="section-card">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">Routing</h2>
          <p className="text-sm text-white/30">Choose which provider handles prompt generation and lyric generation.</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-white/50 mb-1">Prompt provider</label>
            <select
              value={values.PROMPT_LLM_PROVIDER || "openrouter"}
              onChange={(e) => onFieldChange("PROMPT_LLM_PROVIDER", e.target.value)}
              className="select-field font-mono text-sm"
            >
              <option value="openrouter">OpenRouter</option>
              <option value="openai">OpenAI</option>
              <option value="edenai">Eden AI</option>
            </select>
            <p className="text-xs text-white/25 mt-1">Used by Generate Style / prompt optimization.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/50 mb-1">Image prompt provider</label>
            <select
              value={values.IMAGE_LLM_PROVIDER || "openrouter"}
              onChange={(e) => onFieldChange("IMAGE_LLM_PROVIDER", e.target.value)}
              className="select-field font-mono text-sm"
            >
              <option value="openrouter">OpenRouter</option>
              <option value="openai">OpenAI</option>
              <option value="edenai">Eden AI</option>
            </select>
            <p className="text-xs text-white/25 mt-1">Used to write the visual scene description for auto-generated cover art.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/50 mb-1">Lyrics provider</label>
            <select
              value={values.LYRICS_LLM_PROVIDER || "openrouter"}
              onChange={(e) => onFieldChange("LYRICS_LLM_PROVIDER", e.target.value)}
              className="select-field font-mono text-sm"
            >
              <option value="openrouter">OpenRouter</option>
              <option value="openai">OpenAI</option>
              <option value="edenai">Eden AI</option>
            </select>
            <p className="text-xs text-white/25 mt-1">Used by Generate Lyrics and Lyric Studio block generation.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/50 mb-1">Track DNA provider</label>
            <select
              value={values.TRACKDNA_LLM_PROVIDER || "openrouter"}
              onChange={(e) => onFieldChange("TRACKDNA_LLM_PROVIDER", e.target.value)}
              className="select-field font-mono text-sm"
            >
              <option value="openrouter">OpenRouter</option>
              <option value="openai">OpenAI</option>
              <option value="edenai">Eden AI</option>
            </select>
            <p className="text-xs text-white/25 mt-1">
              Used by the automatic Track DNA analysis (atmosphere tags, lyrics quality score, and the text-only
              composition score from the style prompt/lyrics structure) that runs once per finished track. Kept
              separate from Lyrics since it needs reliable JSON output rather than creative writing.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/50 mb-1">Advanced DNA provider</label>
            <select
              value={values.ADVANCED_LLM_PROVIDER || "openrouter"}
              onChange={(e) => onFieldChange("ADVANCED_LLM_PROVIDER", e.target.value)}
              className="select-field font-mono text-sm"
            >
              <option value="openrouter">OpenRouter</option>
              <option value="openai">OpenAI</option>
              <option value="edenai">Eden AI</option>
            </select>
            <p className="text-xs text-white/25 mt-1">
              Used by the Advanced Track DNA analysis, which listens to the actual audio (alongside the lyrics
              and style prompt) for a thorough critique with tips — needs an audio-input-capable model.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/50 mb-1">LyricIQ provider</label>
            <select
              value={values.LYRICIQ_LLM_PROVIDER || "openrouter"}
              onChange={(e) => onFieldChange("LYRICIQ_LLM_PROVIDER", e.target.value)}
              className="select-field font-mono text-sm"
            >
              <option value="openrouter">OpenRouter</option>
              <option value="openai">OpenAI</option>
              <option value="edenai">Eden AI</option>
            </select>
            <p className="text-xs text-white/25 mt-1">
              Used by the LyricIQ™ songwriting assistant that polishes an existing block in the Lyric Studio.
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <div>
              <label className="block text-sm font-medium text-white/50">Auto-analyze composition</label>
              <p className="text-xs text-white/25 mt-1 max-w-md">
                Automatically score composition/arrangement (from the style prompt and lyrics structure) on every
                newly finished track. Off by default — existing tracks are never analyzed in bulk; use
                &ldquo;Analyze Composition&rdquo; on a track&apos;s menu to run it on demand regardless of this
                setting.
              </p>
            </div>
            <button
              type="button"
              aria-label="Toggle auto-analyze composition"
              onClick={onToggleAutoAnalyzeComposition}
              className={`relative w-12 h-6 rounded-full shrink-0 transition-colors ${
                autoAnalyzeComposition ? "bg-emerald-500/20" : "bg-white/10"
              }`}
            >
              <span className="sr-only">Toggle auto-analyze composition</span>
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  autoAnalyzeComposition ? "translate-x-6" : ""
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <div>
              <label className="block text-sm font-medium text-white/50">Auto-open Lyrics Editor after generating TCL</label>
              <p className="text-xs text-white/25 mt-1 max-w-md">
                &ldquo;Generate Time-Coded Lyrics&rdquo; from a track&apos;s menu always generates in place first
                (a progress indicator shows on the track while it runs). On: once it&apos;s done, you&apos;re
                taken straight into the Timecoded Lyrics Editor, ready to play. Off: it just shows up on the
                track card when it&apos;s done.
              </p>
            </div>
            <button
              type="button"
              aria-label="Toggle auto-open Lyrics Editor after generating TCL"
              onClick={onToggleTclAutoJumpToEditor}
              className={`relative w-12 h-6 rounded-full shrink-0 transition-colors ${
                tclAutoJumpToEditor ? "bg-emerald-500/20" : "bg-white/10"
              }`}
            >
              <span className="sr-only">Toggle auto-open Lyrics Editor after generating TCL</span>
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  tclAutoJumpToEditor ? "translate-x-6" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Models</h2>
            <p className="text-sm text-white/30">
              Model used per purpose. Shows the OpenRouter picker when that purpose is routed to OpenRouter above,
              otherwise a plain model name for the selected provider (OpenAI / Eden AI).
            </p>
          </div>
          {onGetModels && (
            <button
              type="button"
              onClick={onGetModels}
              disabled={testingModels}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testingModels ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Retrieving…
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0114.13-3.36L23 10M1 14l5.36 5.36A9 9 0 0020.49 15" />
                  </svg>
                  Retrieve Models
                </>
              )}
            </button>
          )}
        </div>
        <div className="space-y-3">
          <ModelField
            label="Prompt Model"
            provider={values.PROMPT_LLM_PROVIDER || "openrouter"}
            openAiKey="OPENAI_PROMPT_MODEL"
            values={values}
            onFieldChange={onFieldChange}
            openRouterDropdown={
              <OpenRouterModelDropdown
                label="Prompt Model"
                selected={selectedPromptModel}
                open={showPromptDropdown}
                options={filteredModels}
                allModelsLoaded={allModels.length > 0}
                searchQuery={modelSearchQuery}
                onToggle={onTogglePromptDropdown}
                onSelect={onPromptModelSelect}
                onSearchQueryChange={onSearchQueryChange}
                onReadMore={onReadMore}
              />
            }
            edenAiDropdown={
              <OpenRouterModelDropdown
                label="Prompt Model (Eden AI)"
                selected={selectedPromptModel}
                open={showPromptDropdown}
                options={filteredEdenAiModels}
                allModelsLoaded={edenAiModels.length > 0}
                searchQuery={modelSearchQuery}
                onToggle={onTogglePromptDropdown}
                onSelect={onPromptModelSelect}
                onSearchQueryChange={onSearchQueryChange}
                onReadMore={onReadMore}
              />
            }
          />
          <ModelField
            label="Lyrics Model"
            provider={values.LYRICS_LLM_PROVIDER || "openrouter"}
            openAiKey="OPENAI_LYRICS_MODEL"
            values={values}
            onFieldChange={onFieldChange}
            openRouterDropdown={
              <OpenRouterModelDropdown
                label="Lyrics Model"
                selected={selectedLyricsModel}
                open={showLyricsDropdown}
                options={filteredModels}
                allModelsLoaded={allModels.length > 0}
                searchQuery={modelSearchQuery}
                onToggle={onToggleLyricsDropdown}
                onSelect={onLyricsModelSelect}
                onSearchQueryChange={onSearchQueryChange}
                onReadMore={onReadMore}
              />
            }
            edenAiDropdown={
              <OpenRouterModelDropdown
                label="Lyrics Model (Eden AI)"
                selected={selectedLyricsModel}
                open={showLyricsDropdown}
                options={filteredEdenAiModels}
                allModelsLoaded={edenAiModels.length > 0}
                searchQuery={modelSearchQuery}
                onToggle={onToggleLyricsDropdown}
                onSelect={onLyricsModelSelect}
                onSearchQueryChange={onSearchQueryChange}
                onReadMore={onReadMore}
              />
            }
          />
          <ModelField
            label="Image Prompt Model"
            provider={values.IMAGE_LLM_PROVIDER || "openrouter"}
            openAiKey="OPENAI_IMAGE_MODEL"
            values={values}
            onFieldChange={onFieldChange}
            openRouterDropdown={
              <OpenRouterModelDropdown
                label="Image Prompt Model"
                selected={selectedImageModel}
                open={showImageDropdown}
                options={filteredModels}
                allModelsLoaded={allModels.length > 0}
                searchQuery={modelSearchQuery}
                onToggle={onToggleImageDropdown}
                onSelect={onImageModelSelect}
                onSearchQueryChange={onSearchQueryChange}
                onReadMore={onReadMore}
              />
            }
            edenAiDropdown={
              <OpenRouterModelDropdown
                label="Image Prompt Model (Eden AI)"
                selected={selectedImageModel}
                open={showImageDropdown}
                options={filteredEdenAiModels}
                allModelsLoaded={edenAiModels.length > 0}
                searchQuery={modelSearchQuery}
                onToggle={onToggleImageDropdown}
                onSelect={onImageModelSelect}
                onSearchQueryChange={onSearchQueryChange}
                onReadMore={onReadMore}
              />
            }
          />
          <ModelField
            label="Track DNA Model"
            provider={values.TRACKDNA_LLM_PROVIDER || "openrouter"}
            openAiKey="OPENAI_TRACKDNA_MODEL"
            values={values}
            onFieldChange={onFieldChange}
            openRouterDropdown={
              <OpenRouterModelDropdown
                label="Track DNA Model"
                selected={selectedTrackDnaModel}
                open={showTrackDnaDropdown}
                options={filteredModels}
                allModelsLoaded={allModels.length > 0}
                searchQuery={modelSearchQuery}
                onToggle={onToggleTrackDnaDropdown}
                onSelect={onTrackDnaModelSelect}
                onSearchQueryChange={onSearchQueryChange}
                onReadMore={onReadMore}
              />
            }
            edenAiDropdown={
              <OpenRouterModelDropdown
                label="Track DNA Model (Eden AI)"
                selected={selectedTrackDnaModel}
                open={showTrackDnaDropdown}
                options={filteredEdenAiModels}
                allModelsLoaded={edenAiModels.length > 0}
                searchQuery={modelSearchQuery}
                onToggle={onToggleTrackDnaDropdown}
                onSelect={onTrackDnaModelSelect}
                onSearchQueryChange={onSearchQueryChange}
                onReadMore={onReadMore}
              />
            }
          />
          <div>
            <ModelField
              label="Advanced DNA Model"
              provider={values.ADVANCED_LLM_PROVIDER || "openrouter"}
              openAiKey="OPENAI_ADVANCED_DNA_MODEL"
              values={values}
              onFieldChange={onFieldChange}
              openRouterDropdown={
                <OpenRouterModelDropdown
                  label="Advanced DNA Model"
                  selected={selectedAdvancedDnaModel}
                  open={showAdvancedDnaDropdown}
                  options={filteredModelsForAdvancedDna}
                  allModelsLoaded={allModels.length > 0}
                  searchQuery={modelSearchQuery}
                  onToggle={onToggleAdvancedDnaDropdown}
                  onSelect={onAdvancedDnaModelSelect}
                  onSearchQueryChange={onSearchQueryChange}
                  onReadMore={onReadMore}
                  showRecommended={false}
                />
              }
              edenAiDropdown={
                <OpenRouterModelDropdown
                  label="Advanced DNA Model (Eden AI)"
                  selected={selectedAdvancedDnaModel}
                  open={showAdvancedDnaDropdown}
                  options={filteredEdenAiModelsForAdvancedDna}
                  allModelsLoaded={edenAiModels.length > 0}
                  searchQuery={modelSearchQuery}
                  onToggle={onToggleAdvancedDnaDropdown}
                  onSelect={onAdvancedDnaModelSelect}
                  onSearchQueryChange={onSearchQueryChange}
                  onReadMore={onReadMore}
                  showRecommended={false}
                />
              }
            />
            <p className="text-xs text-white/25 mt-1">Only models that can process audio input are listed, for future composition analysis from the actual track.</p>
          </div>
          <ModelField
            label="LyricIQ Model"
            provider={values.LYRICIQ_LLM_PROVIDER || "openrouter"}
            openAiKey="OPENAI_LYRICIQ_MODEL"
            values={values}
            onFieldChange={onFieldChange}
            openRouterDropdown={
              <OpenRouterModelDropdown
                label="LyricIQ Model"
                selected={selectedLyricIqModel}
                open={showLyricIqDropdown}
                options={filteredModels}
                allModelsLoaded={allModels.length > 0}
                searchQuery={modelSearchQuery}
                onToggle={onToggleLyricIqDropdown}
                onSelect={onLyricIqModelSelect}
                onSearchQueryChange={onSearchQueryChange}
                onReadMore={onReadMore}
              />
            }
            edenAiDropdown={
              <OpenRouterModelDropdown
                label="LyricIQ Model (Eden AI)"
                selected={selectedLyricIqModel}
                open={showLyricIqDropdown}
                options={filteredEdenAiModels}
                allModelsLoaded={edenAiModels.length > 0}
                searchQuery={modelSearchQuery}
                onToggle={onToggleLyricIqDropdown}
                onSelect={onLyricIqModelSelect}
                onSearchQueryChange={onSearchQueryChange}
                onReadMore={onReadMore}
              />
            }
          />
          {isAdmin && onTimecodedModelSelect && onToggleTimecodedDropdown && (
            <div>
              <ModelField
                label="Timecoded Editor Model"
                provider={values.LYRICS_LLM_PROVIDER || "openrouter"}
                openAiKey="OPENAI_TIMECODED_MODEL"
                values={values}
                onFieldChange={onFieldChange}
                openRouterDropdown={
                  <OpenRouterModelDropdown
                    label="Timecoded Editor Model"
                    selected={selectedTimecodedModel ?? null}
                    open={!!showTimecodedDropdown}
                    options={filteredModels}
                    allModelsLoaded={allModels.length > 0}
                    searchQuery={modelSearchQuery}
                    onToggle={onToggleTimecodedDropdown}
                    onSelect={onTimecodedModelSelect}
                    onSearchQueryChange={onSearchQueryChange}
                    onReadMore={onReadMore}
                  />
                }
                edenAiDropdown={
                  <OpenRouterModelDropdown
                    label="Timecoded Editor Model (Eden AI)"
                    selected={selectedTimecodedModel ?? null}
                    open={!!showTimecodedDropdown}
                    options={filteredEdenAiModels}
                    allModelsLoaded={edenAiModels.length > 0}
                    searchQuery={modelSearchQuery}
                    onToggle={onToggleTimecodedDropdown}
                    onSelect={onTimecodedModelSelect}
                    onSearchQueryChange={onSearchQueryChange}
                    onReadMore={onReadMore}
                  />
                }
              />
              <p className="text-xs text-white/25 mt-1">Follows the Lyrics provider above (no separate Timecoded provider) — that's what the AI editor actually uses.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
