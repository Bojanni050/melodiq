"use client";

import ModelSelector from "@/components/settings/ModelSelector";
import type { LLMModel } from "@/lib/settings-utils";

export default function OpenRouterModelDropdown({
  label,
  selected,
  open,
  options,
  allModelsLoaded,
  searchQuery,
  onToggle,
  onSelect,
  onSearchQueryChange,
  onReadMore,
}: {
  label: string;
  selected: LLMModel | null;
  open: boolean;
  options: LLMModel[];
  allModelsLoaded: boolean;
  searchQuery: string;
  onToggle: () => void;
  onSelect: (model: LLMModel) => void;
  onSearchQueryChange: (value: string) => void;
  onReadMore: (model: LLMModel) => void;
}) {
  return (
    <div className="relative">
      <label className="block text-xs font-medium text-white/50 mb-1">{label}</label>
      {allModelsLoaded ? (
        <button
          type="button"
          onClick={onToggle}
          className="w-full input-field font-mono text-sm text-left flex items-center justify-between"
        >
          <span className="truncate">{selected ? selected.name : "Select a model..."}</span>
          <svg
            className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      ) : (
        <div className="input-field font-mono text-sm text-white/60">
          {selected ? selected.name : "Retrieve models to select"}
        </div>
      )}

      {open && options.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-white/10 bg-[#1a1a24] p-2 shadow-xl">
          <ModelSelector
            label={`${label} options`}
            selected={selected}
            options={options}
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange}
            onSelect={onSelect}
            onReadMore={onReadMore}
          />
        </div>
      )}
    </div>
  );
}
