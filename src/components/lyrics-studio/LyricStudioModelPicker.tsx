"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/hooks/useT";
import { formatPrice, truncateDescription, type LLMModel } from "@/lib/settings-utils";
import { estimateSongGenerationCost } from "@/lib/lyrics-utils";

function matchesQuery(model: LLMModel, query: string): boolean {
  const q = query.toLowerCase();
  return model.id.toLowerCase().includes(q) || model.name.toLowerCase().includes(q);
}

function formatEstimatedCost(cost: number, freeLabel: string): string {
  if (cost <= 0) return freeLabel;
  return `$${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2)}`;
}

function ModelRow({ model, selected, blockCount, onSelect }: { model: LLMModel; selected: boolean; blockCount: number; onSelect: () => void }) {
  const t = useT();
  const description = truncateDescription(model.description, 2);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full px-3 py-2 text-left border-b border-line last:border-b-0 transition-colors ${selected ? "bg-accent/10" : "hover:bg-white/5"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-ink truncate">{model.name}</p>
        {selected && <span className="shrink-0 text-[11px] font-medium text-accent">{t("lyricsStudio.selectedLabel")}</span>}
      </div>
      <p className="text-[11px] text-ink-dim font-mono truncate">{model.id}</p>
      <p className="text-[11px] text-ink-dim mt-0.5">
        {t("lyricsStudio.priceInOut", { inPrice: formatPrice(model.pricing.prompt), outPrice: formatPrice(model.pricing.completion) })}
      </p>
      {blockCount > 0 && (
        <p className="text-[11px] text-ink-dim">
          {t("lyricsStudio.estimatedFullSongCost", { count: blockCount, cost: formatEstimatedCost(estimateSongGenerationCost(model.pricing, blockCount), t("lyricsStudio.freeLabel")) })}
        </p>
      )}
      {description.text && <p className="text-[11px] text-ink-dim mt-0.5 leading-snug">{description.text}</p>}
    </button>
  );
}

export default function LyricStudioModelPicker({
  value,
  onChange,
  recommended,
  others,
  loaded,
  loading,
  error,
  onLoad,
  blockCount,
}: {
  value: string;
  onChange: (id: string) => void;
  recommended: LLMModel[];
  others: LLMModel[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  onLoad: () => void;
  blockCount: number;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => [...recommended, ...others].find((m) => m.id === value) || null, [recommended, others, value]);
  const estimatedCost = useMemo(
    () => (selected && blockCount > 0 ? estimateSongGenerationCost(selected.pricing, blockCount) : null),
    [selected, blockCount]
  );
  const filteredRecommended = useMemo(() => (searchQuery ? recommended.filter((m) => matchesQuery(m, searchQuery)) : recommended), [recommended, searchQuery]);
  const filteredOthers = useMemo(() => (searchQuery ? others.filter((m) => matchesQuery(m, searchQuery)) : others), [others, searchQuery]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(id: string) {
    onChange(id);
    setOpen(false);
    setSearchQuery("");
  }

  return (
    <div className=" border border-line bg-white/5 px-3 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm text-ink/85">
          {t("lyricsStudio.llmModelLabel")}{selected ? ` — ${selected.name}` : ""}
        </label>
        {(loaded || error) && (
          <button
            type="button"
            onClick={onLoad}
            disabled={loading}
            title={t("lyricsStudio.reloadModelsTooltip")}
            className="text-xs text-ink-dim transition hover:text-ink-muted disabled:opacity-40"
          >
            {loading ? t("lyricsStudio.loadingEllipsis") : t("lyricsStudio.refresh")}
          </button>
        )}
      </div>

      {!loaded ? (
        <button
          type="button"
          onClick={onLoad}
          disabled={loading}
          className="inline-flex w-full items-center justify-center  border border-line bg-white/5 px-3 py-2 text-sm text-ink-muted transition hover:bg-white/10 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? t("lyricsStudio.loadingModels") : t("lyricsStudio.fetchModels")}
        </button>
      ) : (
        <div ref={containerRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full input-field font-mono text-sm text-left flex items-center justify-between gap-2"
          >
            <span className="truncate">
              {selected
                ? `${selected.name} — ${t("lyricsStudio.priceInOut", { inPrice: formatPrice(selected.pricing.prompt), outPrice: formatPrice(selected.pricing.completion) })}`
                : t("lyricsStudio.defaultFromSettings")}
            </span>
            <svg className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {estimatedCost !== null && (
            <p className="mt-1.5 text-xs text-ink-dim">
              {t("lyricsStudio.estimatedFullSongCost", { count: blockCount, cost: formatEstimatedCost(estimatedCost, t("lyricsStudio.freeLabel")) })}
            </p>
          )}

          {open && (
            <div className="absolute z-50 mt-1 w-full  border border-line bg-surface p-2 shadow-xl">
              <input
                type="text"
                placeholder={t("lyricsStudio.searchModelsPlaceholder")}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-line rounded text-sm placeholder-white/30 focus:outline-none focus:border-accent"
              />
              <div className="mt-2 max-h-80 overflow-y-auto border border-line  bg-surface">
                <button
                  type="button"
                  onClick={() => select("")}
                  className={`w-full px-3 py-2 text-left border-b border-line transition-colors ${!value ? "bg-accent/10" : "hover:bg-white/5"}`}
                >
                  <p className="text-sm text-ink">{t("lyricsStudio.defaultFromSettings")}</p>
                  <p className="text-[11px] text-ink-dim">{t("lyricsStudio.usesSettingsModelHint")}</p>
                </button>

                {filteredRecommended.length > 0 && (
                  <>
                    <div className="bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-dim">{t("lyricsStudio.recommended")}</div>
                    {filteredRecommended.map((model) => (
                      <ModelRow key={model.id} model={model} selected={model.id === value} blockCount={blockCount} onSelect={() => select(model.id)} />
                    ))}
                  </>
                )}

                {filteredOthers.length > 0 && (
                  <>
                    <div className="bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-dim">{t("lyricsStudio.otherModelsAZ")}</div>
                    {filteredOthers.map((model) => (
                      <ModelRow key={model.id} model={model} selected={model.id === value} blockCount={blockCount} onSelect={() => select(model.id)} />
                    ))}
                  </>
                )}

                {filteredRecommended.length === 0 && filteredOthers.length === 0 && (
                  <p className="px-3 py-2 text-sm text-ink-dim">{t("lyricsStudio.noModelsFound")}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-ink-dim">
        {error
          ? error
          : value
            ? t("lyricsStudio.overridesProjectOnlyHint")
            : t("lyricsStudio.defaultUsesSettingsModelHint")}
      </p>
    </div>
  );
}
