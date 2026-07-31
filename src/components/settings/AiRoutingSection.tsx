"use client";

import OpenRouterModelDropdown from "@/components/settings/OpenRouterModelDropdown";
import type { LLMModel } from "@/lib/settings-utils";

export default function AiRoutingSection({
  values,
  onFieldChange,
  allModels,
  filteredModels,
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
  onReadMore,
}: {
  values: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  allModels: LLMModel[];
  filteredModels: LLMModel[];
  modelSearchQuery: string;
  selectedPromptModel: LLMModel | null;
  selectedLyricsModel: LLMModel | null;
  selectedImageModel: LLMModel | null;
  selectedTrackDnaModel: LLMModel | null;
  showPromptDropdown: boolean;
  showLyricsDropdown: boolean;
  showImageDropdown: boolean;
  showTrackDnaDropdown: boolean;
  onSearchQueryChange: (query: string) => void;
  onPromptModelSelect: (model: LLMModel) => void;
  onLyricsModelSelect: (model: LLMModel) => void;
  onImageModelSelect: (model: LLMModel) => void;
  onTrackDnaModelSelect: (model: LLMModel) => void;
  onTogglePromptDropdown: () => void;
  onToggleLyricsDropdown: () => void;
  onToggleImageDropdown: () => void;
  onToggleTrackDnaDropdown: () => void;
  onReadMore: (model: LLMModel) => void;
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
            </select>
            <p className="text-xs text-white/25 mt-1">Used by Generate Style / prompt optimization.</p>
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
            </select>
            <p className="text-xs text-white/25 mt-1">
              Used by the automatic Track DNA analysis (atmosphere tags &amp; lyrics quality score) that runs once
              per finished track. Kept separate from Lyrics since it needs reliable JSON output rather than
              creative writing.
            </p>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">Models</h2>
          <p className="text-sm text-white/30">
            OpenRouter models used for prompt optimization, lyrics, and image prompts. Retrieve models from the
            OpenRouter provider card under Providers &rarr; LLM.
          </p>
        </div>
        <div className="space-y-3">
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
        </div>
      </section>
    </div>
  );
}
