"use client";

import { useState, useEffect } from "react";
import { useT } from "@/hooks/useT";
import BlockToolbar from "@/components/lyrics-studio/BlockToolbar";
import PresetSelector from "@/components/lyrics-studio/PresetSelector";
import LyricStudioModelPicker from "@/components/lyrics-studio/LyricStudioModelPicker";
import {
  LANGUAGES,
  STRUCTURES,
  STRUCTURE_PRESET_MAP,
  MOOD_SUGGESTIONS,
  STYLE_SUGGESTIONS,
} from "@/lib/lyrics-studio-constants";
import type { BlockType } from "@/lib/lyrics-utils";
import type { LLMModel } from "@/lib/settings-utils";

type LyricsControlPanelProps = {
  topic: string;
  mood: string;
  style: string;
  vocalistTag: "auto" | "male" | "female" | "together" | "duet";
  performerDirections: string;
  titleValue: string;
  generatingTitle: boolean;
  canGenerateTitle: boolean;
  selectedLanguage: string;
  isCustomLanguage: boolean;
  customLanguage: string;
  structure: string;
  customStructure: string;
  showStructureDropdown: boolean;
  activePreset: string;
  repetitiveChorus: boolean;
  creativityLevel: number;
  creativityZone: string;
  temperature: number;
  literalnessLevel: number;
  literalnessZone: string;
  onLiteralnessLevelChange: (value: number) => void;
  contextLevel: number;
  contextZone: string;
  topP: number;
  llmModel: string;
  onLlmModelChange: (value: string) => void;
  estimatedSongBlockCount: number;
  canGenerateBlocks: boolean;
  generatingSong: boolean;
  blockTypes: BlockType[];
  blockLabels: Record<BlockType, string>;
  blockColors: Record<BlockType, string>;
  presets: Record<string, BlockType[]>;
  combinedLyrics: string;
  copied: boolean;
  onTopicChange: (value: string) => void;
  onMoodChange: (value: string) => void;
  onStyleChange: (value: string) => void;
  onVocalistTagChange: (value: "auto" | "male" | "female" | "together" | "duet") => void;
  onPerformerDirectionsChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onGenerateTitle: () => void;
  onLanguageChange: (value: string) => void;
  onCustomLanguageChange: (value: string) => void;
  onStructureChange: (value: string) => void;
  onCustomStructureChange: (value: string) => void;
  onToggleStructureDropdown: () => void;
  onStructureDropdownClose: () => void;
  onPresetApply: (name: string) => void;
  onActivePresetClear: () => void;
  onRepetitiveChorusChange: (value: boolean) => void;
  onCreativityLevelChange: (value: number) => void;
  onContextLevelChange: (value: number) => void;
  onGenerateSong: () => void;
  onStopGenerating: () => void;
  onAddBlock: (type: BlockType) => void;
  onClearAll: () => void;
  onCopyAll: () => void;
  onSaveCurrentStructure?: (name: string) => void;
  onDeleteCustomPreset?: (name: string) => void;
};

export default function LyricsControlPanel({
  topic,
  mood,
  style,
  vocalistTag,
  performerDirections,
  titleValue,
  generatingTitle,
  canGenerateTitle,
  selectedLanguage,
  isCustomLanguage,
  customLanguage,
  structure,
  customStructure,
  showStructureDropdown,
  activePreset,
  repetitiveChorus,
  creativityLevel,
  creativityZone,
  temperature,
  literalnessLevel,
  literalnessZone,
  onLiteralnessLevelChange,
  contextLevel,
  contextZone,
  topP,
  llmModel,
  onLlmModelChange,
  estimatedSongBlockCount,
  canGenerateBlocks,
  generatingSong,
  blockTypes,
  blockLabels,
  blockColors,
  presets,
  combinedLyrics,
  copied,
  onTopicChange,
  onMoodChange,
  onStyleChange,
  onVocalistTagChange,
  onPerformerDirectionsChange,
  onTitleChange,
  onGenerateTitle,
  onLanguageChange,
  onCustomLanguageChange,
  onStructureChange,
  onCustomStructureChange,
  onToggleStructureDropdown,
  onStructureDropdownClose,
  onPresetApply,
  onActivePresetClear,
  onRepetitiveChorusChange,
  onCreativityLevelChange,
  onContextLevelChange,
  onGenerateSong,
  onStopGenerating,
  onAddBlock,
  onClearAll,
  onCopyAll,
  onSaveCurrentStructure,
  onDeleteCustomPreset,
}: LyricsControlPanelProps) {
  const t = useT();
  const [displayedMoods, setDisplayedMoods] = useState<string[]>([]);
  const [displayedStyles, setDisplayedStyles] = useState<string[]>([]);
  const [isShufflingMoods, setIsShufflingMoods] = useState(false);
  const [isShufflingStyles, setIsShufflingStyles] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  const [modelOptions, setModelOptions] = useState<{ recommended: LLMModel[]; others: LLMModel[]; defaultModel?: LLMModel | null } | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const selectedModelName = llmModel
    ? modelOptions
      ? [...modelOptions.recommended, ...modelOptions.others].find((m) => m.id === llmModel)?.name || llmModel.split("/").pop() || llmModel
      : llmModel.split("/").pop() || llmModel
    : modelOptions?.defaultModel?.name || t("lyricsStudio.defaultFromSettings");

  function loadModelOptions() {
    if (modelsLoading) return;
    setModelsLoading(true);
    setModelsError(null);
    fetch("/api/lyric-studio/models")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setModelsError(data?.error || t("lyricsStudio.modelsLoadFailed"));
          return;
        }
        setModelOptions({ recommended: data.recommended ?? [], others: data.others ?? [], defaultModel: data.defaultModel ?? null });
      })
      .catch(() => {
        setModelsError(t("lyricsStudio.modelsLoadFailed"));
      })
      .finally(() => {
        setModelsLoading(false);
      });
  }

  function getRandomSubset(arr: string[], count = 12): string[] {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  useEffect(() => {
    setDisplayedMoods(getRandomSubset(MOOD_SUGGESTIONS));
    setDisplayedStyles(getRandomSubset(STYLE_SUGGESTIONS));
  }, []);

  useEffect(() => {
    loadModelOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function shuffleMoods() {
    setIsShufflingMoods(true);
    setDisplayedMoods(getRandomSubset(MOOD_SUGGESTIONS));
    setTimeout(() => setIsShufflingMoods(false), 500);
  }

  function shuffleStyles() {
    setIsShufflingStyles(true);
    setDisplayedStyles(getRandomSubset(STYLE_SUGGESTIONS));
    setTimeout(() => setIsShufflingStyles(false), 500);
  }

  function toggleTag(currentValue: string, tag: string): string {
    const tags = currentValue
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const tagLower = tag.toLowerCase();
    const index = tags.findIndex((t) => t.toLowerCase() === tagLower);
    if (index >= 0) {
      tags.splice(index, 1);
    } else {
      tags.push(tag);
    }
    return tags.join(", ");
  }
  return (
    <aside className="space-y-4 lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:pr-1">
      <section className="section-card">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-ink-muted">{t("lyricsStudio.songMetadataHeading")}</h3>
          <p className="mt-1 text-sm text-ink-dim">{t("lyricsStudio.songMetadataHint")}</p>
        </div>

        <div className="space-y-3">
          <div>
            <textarea
              value={topic}
              onChange={(event) => onTopicChange(event.target.value)}
              placeholder={t("lyricsStudio.topicPlaceholder")}
              rows={2}
              className="input-field text-sm min-h-[56px] resize-y py-2"
            />
          </div>

          <div className="space-y-1.5">
            <input
              type="text"
              value={mood}
              onChange={(event) => onMoodChange(event.target.value)}
              placeholder={t("lyricsStudio.moodPlaceholder")}
              className="input-field text-sm"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={shuffleMoods}
                title={t("lyricsStudio.refreshSuggestionsTooltip")}
                className="flex h-7 w-7 shrink-0 items-center justify-center  border border-line bg-white/5 text-ink-dim transition hover:border-line/20 hover:bg-white/10 hover:text-ink"
              >
                <svg className={`h-3.5 w-3.5 ${isShufflingMoods ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
                </svg>
              </button>
              <div className="no-scrollbar flex flex-1 items-center gap-1.5 overflow-x-auto py-0.5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {displayedMoods.map((tag) => {
                  const tagsArray = mood.split(",").map(t => t.trim().toLowerCase());
                  const isActive = tagsArray.includes(tag.toLowerCase());
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onMoodChange(toggleTag(mood, tag))}
                      className={`rounded-full border px-2.5 py-0.5 text-sm transition duration-200 cursor-pointer ${
                        isActive
                          ? "border-accent bg-accent/20 text-ink font-medium shadow-[0_0_10px_rgba(255,83,12,0.15)]"
                          : "border-line bg-white/5 text-ink-dim hover:border-line-strong hover:bg-white/10 hover:text-ink"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden  border border-line bg-gradient-to-b from-white/8 to-white/4 p-px">
            <select
              value={selectedLanguage}
              onChange={(event) => onLanguageChange(event.target.value)}
              aria-label={t("lyricsStudio.languageAriaLabel")}
              className="select-field w-full appearance-none border-0 bg-surface pr-10 text-sm shadow-none"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang} className="bg-gray-900">
                  {lang}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim">
              v
            </span>
          </div>

          {isCustomLanguage && (
            <input
              type="text"
              value={customLanguage}
              onChange={(event) => onCustomLanguageChange(event.target.value)}
              placeholder={t("lyricsStudio.customLanguagePlaceholder")}
              className="input-field text-sm"
            />
          )}

          <div className="space-y-1.5">
            <input
              type="text"
              value={style}
              onChange={(event) => onStyleChange(event.target.value)}
              placeholder={t("lyricsStudio.stylePlaceholder")}
              className="input-field text-sm"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={shuffleStyles}
                title={t("lyricsStudio.refreshSuggestionsTooltip")}
                className="flex h-7 w-7 shrink-0 items-center justify-center  border border-line bg-white/5 text-ink-dim transition hover:border-line/20 hover:bg-white/10 hover:text-ink"
              >
                <svg className={`h-3.5 w-3.5 ${isShufflingStyles ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
                </svg>
              </button>
              <div className="no-scrollbar flex flex-1 items-center gap-1.5 overflow-x-auto py-0.5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {displayedStyles.map((tag) => {
                  const tagsArray = style.split(",").map(t => t.trim().toLowerCase());
                  const isActive = tagsArray.includes(tag.toLowerCase());
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onStyleChange(toggleTag(style, tag))}
                      className={`rounded-full border px-2.5 py-0.5 text-sm transition duration-200 cursor-pointer ${
                        isActive
                          ? "border-accent bg-accent/20 text-ink font-medium shadow-[0_0_10px_rgba(255,83,12,0.15)]"
                          : "border-line bg-white/5 text-ink-dim hover:border-line-strong hover:bg-white/10 hover:text-ink"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[170px_minmax(0,1fr)]">
            <div className="relative overflow-hidden  border border-line bg-gradient-to-b from-white/8 to-white/4 p-px">
              <select
                value={vocalistTag}
                onChange={(event) => onVocalistTagChange(event.target.value as "auto" | "male" | "female" | "together" | "duet")}
                aria-label={t("lyricsStudio.vocalistTagAriaLabel")}
                className="select-field w-full appearance-none border-0 bg-surface pr-10 text-sm shadow-none"
              >
                <option value="auto" className="bg-gray-900">{t("lyricsStudio.vocalTagAuto")}</option>
                <option value="male" className="bg-gray-900">[male]</option>
                <option value="female" className="bg-gray-900">[female]</option>
                <option value="together" className="bg-gray-900">[together]</option>
                <option value="duet" className="bg-gray-900">{t("lyricsStudio.vocalTagDuet")}</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim">
                v
              </span>
            </div>
            <input
              type="text"
              value={performerDirections}
              onChange={(event) => onPerformerDirectionsChange(event.target.value)}
              placeholder={vocalistTag === "duet"
                ? t("lyricsStudio.duetDirectionsPlaceholder")
                : t("lyricsStudio.vocalDirectionPlaceholder")}
              className="input-field text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              type="text"
              value={titleValue}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder={t("lyricsStudio.songTitlePlaceholder")}
              className="input-field text-sm"
            />
            <button
              type="button"
              onClick={onGenerateTitle}
              disabled={generatingTitle || !canGenerateTitle}
              title={canGenerateTitle ? t("lyricsStudio.generateTitleTooltip") : t("lyricsStudio.addMoreLyricsFirstTooltip")}
              className="inline-flex items-center justify-center  border border-line bg-white/5 px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-white/10 hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
            >
              {generatingTitle ? t("studio.generating") : t("lyricsStudio.generateTitleButton")}
            </button>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-muted">{t("lyricsStudio.songStructureHeading")}</h3>
          {structure && (
            <button
              type="button"
              onClick={onActivePresetClear}
              className="text-ink-dim transition-colors hover:text-ink-muted"
              title={t("lyricsStudio.clearStructureTooltip")}
            >
              x
            </button>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={onToggleStructureDropdown}
            className="input-field flex w-full items-center justify-between text-left text-sm"
          >
            <span className={structure ? "text-ink" : "text-ink-dim"}>
              {structure === "ai-choose"
                ? t("lyricsStudio.aiChooseLabel")
                : structure === "manual"
                  ? t("lyricsStudio.manualLabel")
                  : structure
                    ? STRUCTURES.find((item) => item.value === structure)?.label || t("lyricsStudio.selectEllipsis")
                    : t("lyricsStudio.selectStructurePlaceholder")}
            </span>
            <span className={showStructureDropdown ? "rotate-180 transition-transform" : "transition-transform"}>
              v
            </span>
          </button>

          {showStructureDropdown && (
            <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto overflow-hidden  border border-line bg-surface shadow-xl">
              {STRUCTURES.map((item, index) => {
                if (item.group) {
                  return (
                    <div key={`${item.label}-${index}`} className="bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-dim">
                      {item.label}
                    </div>
                  );
                }

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      onStructureChange(item.value || "");
                      onPresetApply(STRUCTURE_PRESET_MAP[item.value || ""] || "");
                      onStructureDropdownClose();
                    }}
                    className={`w-full px-3 py-2.5 text-left transition-colors ${
                      structure === item.value
                        ? "bg-accent/10 text-ink"
                        : "text-ink-muted hover:bg-white/5"
                    }`}
                  >
                    <p className="text-sm">{item.label}</p>
                    <p className="mt-0.5 text-xs text-ink-dim">{item.desc}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {structure === "manual" && (
          <textarea
            value={customStructure}
            onChange={(event) => onCustomStructureChange(event.target.value)}
            placeholder={t("lyricsStudio.customStructurePlaceholder")}
            className="input-field mt-3 min-h-[80px] resize-y text-sm"
          />
        )}

        {structure && structure !== "ai-choose" && structure !== "manual" && (
          <p className="mt-2 text-xs text-ink-dim">
            {STRUCTURES.find((item) => item.value === structure)?.desc}
          </p>
        )}

        <PresetSelector
          presets={presets}
          activePreset={activePreset}
          onApplyPreset={onPresetApply}
          onDeletePreset={onDeleteCustomPreset}
        />

        <div className="mt-3">
          {!isSavingPreset ? (
            <button
              type="button"
              onClick={() => {
                setIsSavingPreset(true);
                setNewPresetName("");
              }}
              className="inline-flex w-full items-center justify-center gap-1.5  border border-dashed border-line-strong bg-white/0 px-3 py-2 text-sm font-semibold text-ink/55 transition hover:border-line/25 hover:bg-white/5 hover:text-ink"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t("lyricsStudio.saveCurrentStructureButton")}
            </button>
          ) : (
            <div className=" border border-line bg-white/5 p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-dim">{t("lyricsStudio.saveNewStructureHeading")}</p>
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder={t("lyricsStudio.presetNamePlaceholderExample")}
                className="input-field text-sm py-1.5"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsSavingPreset(false)}
                  className="rounded px-2.5 py-1 text-sm font-medium text-ink-muted hover:text-ink transition"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = newPresetName.trim();
                    if (trimmed && onSaveCurrentStructure) {
                      onSaveCurrentStructure(trimmed);
                      setIsSavingPreset(false);
                    }
                  }}
                  disabled={!newPresetName.trim()}
                  className="rounded bg-accent px-3 py-1 text-sm font-semibold text-ink hover:bg-accent disabled:opacity-45 disabled:cursor-not-allowed transition"
                >
                  {t("common.save")}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-line mt-4 pt-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-sm">
            <span className="shrink-0 text-ink/85">{t("lyricsStudio.lyricsGeneratorLabel")}</span>
            <span className="truncate text-right font-mono text-ink-muted">{selectedModelName}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-dim transition hover:text-ink-muted py-1"
          >
            <span>{t("lyricsStudio.advancedSettings")}</span>
            <span className={`transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`}>
              ▼
            </span>
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3">
              <label className="flex items-start gap-2  border border-line bg-white/5 px-3 py-2 text-sm text-ink-muted">
                <input
                  type="checkbox"
                  checked={repetitiveChorus}
                  onChange={(event) => onRepetitiveChorusChange(event.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  {t("lyricsStudio.repetitiveChorusLabel")}
                  <span className="block text-xs text-ink-dim">
                    {repetitiveChorus
                      ? t("lyricsStudio.repetitiveChorusOnHint")
                      : t("lyricsStudio.repetitiveChorusOffHint")}
                  </span>
                </span>
              </label>

              <LyricStudioModelPicker
                value={llmModel}
                onChange={onLlmModelChange}
                recommended={modelOptions?.recommended ?? []}
                others={modelOptions?.others ?? []}
                loaded={!!modelOptions}
                loading={modelsLoading}
                error={modelsError}
                onLoad={loadModelOptions}
                blockCount={estimatedSongBlockCount}
              />

              <div className=" border border-line bg-white/5 px-3 py-3">
                <div className="flex items-center justify-between text-sm text-ink/85">
                  <span>{t("lyricsStudio.creativityLabel")}</span>
                  <span>{creativityLevel}/10</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={creativityLevel}
                  onChange={(event) => onCreativityLevelChange(Number(event.target.value))}
                  aria-label="Creativity level"
                  className="mt-2 w-full accent-accent"
                />
                <p className="mt-1 text-xs text-ink-dim">
                  {t("lyricsStudio.creativityZonesHint", { zone: creativityZone, temp: temperature.toFixed(2) })}
                </p>
              </div>

              <div className=" border border-line bg-white/5 px-3 py-3">
                <div className="flex items-center justify-between text-sm text-ink/85">
                  <span>{t("lyricsStudio.literalnessLabel")}</span>
                  <span>{literalnessLevel}/10</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={literalnessLevel}
                  onChange={(event) => onLiteralnessLevelChange(Number(event.target.value))}
                  aria-label="Literalness level"
                  className="mt-2 w-full accent-accent"
                />
                <p className="mt-1 text-xs text-ink-dim">
                  {t("lyricsStudio.literalnessZonesHint", { zone: literalnessZone })}
                </p>
              </div>

              <div className=" border border-line bg-white/5 px-3 py-3">
                <div className="flex items-center justify-between text-sm text-ink/85">
                  <span>{t("lyricsStudio.contextLabel")}</span>
                  <span>{contextLevel}/10</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={contextLevel}
                  onChange={(event) => onContextLevelChange(Number(event.target.value))}
                  aria-label="Context level"
                  className="mt-2 w-full accent-accent"
                />
                <p className="mt-1 text-xs text-ink-dim">
                  {t("lyricsStudio.contextZonesHint", { zone: contextZone, topP: topP.toFixed(2) })}
                </p>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onGenerateSong}
          disabled={!canGenerateBlocks || generatingSong}
          title={canGenerateBlocks ? t("lyricsStudio.generateCompleteSongTooltip") : t("lyricsStudio.addTopicMoodFirstTooltip")}
          className="mt-4 inline-flex w-full items-center justify-center  bg-primary-gradient px-4 py-2 text-sm font-semibold text-ink transition disabled:cursor-not-allowed disabled:opacity-45"
        >
          {generatingSong ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-line/30 border-t-white" />
          ) : (
            t("lyricsStudio.generateCompleteSongButton")
          )}
        </button>

        {generatingSong && (
          <button
            type="button"
            onClick={onStopGenerating}
            className="mt-2 inline-flex w-full items-center justify-center  border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
          >
            {t("lyricsStudio.stopGeneratingButton")}
          </button>
        )}
      </section>

      <BlockToolbar
        blockTypes={blockTypes}
        blockLabels={blockLabels}
        blockColors={blockColors}
        onAddBlock={onAddBlock}
        onClearAll={onClearAll}
        onCopyAll={onCopyAll}
        combinedLyrics={combinedLyrics}
        copied={copied}
      />
    </aside>
  );
}
