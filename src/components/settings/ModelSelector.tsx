"use client";

import { LLMModel } from "@/lib/settings-utils";

export default function ModelSelector({
  label,
  selected,
  options,
  searchQuery,
  onSearchQueryChange,
  onSelect,
  onReadMore,
}: {
  label: string;
  selected: LLMModel | null;
  options: LLMModel[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSelect: (model: LLMModel) => void;
  onReadMore?: (model: LLMModel) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-white/50 mb-1">{label}</label>
      <input
        type="text"
        placeholder="Search models..."
        value={searchQuery}
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm placeholder-white/30 focus:outline-none focus:border-primary-500"
        onChange={(event) => onSearchQueryChange(event.target.value)}
      />
      <div className="max-h-64 overflow-y-auto border border-white/10 rounded-lg bg-[#1a1a24]">
        {options.length === 0 ? (
          <p className="px-3 py-2 text-xs text-white/40">No models found</p>
        ) : (
          options.map((model) => {
            const isSelected = selected?.id === model.id;
            return (
              <div
                key={model.id}
                className={`px-3 py-2 border-b border-white/5 last:border-b-0 ${isSelected ? "bg-primary-500/10" : "hover:bg-white/5"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{model.name}</p>
                    <p className="text-[11px] text-white/40 font-mono truncate">{model.id}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {onReadMore && (
                      <button
                        type="button"
                        onClick={() => onReadMore(model)}
                        className="text-xs text-primary-400 hover:text-primary-300"
                      >
                        Read more
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelect(model)}
                      className={`text-xs px-2 py-1 rounded ${isSelected ? "bg-primary-500 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"}`}
                    >
                      {isSelected ? "Selected" : "Select"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
