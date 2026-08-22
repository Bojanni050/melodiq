"use client";

import { formatPrice, truncateDescription, LLMModel } from "@/lib/settings-utils";

const MODALITY_LABELS: Record<string, string> = {
  image: "Vision",
  video: "Video",
  audio: "Audio",
  file: "Files",
};

// Only worth calling out modalities beyond plain text (every LLM handles
// text), and only for providers whose catalog reports this (see LLMModel.capabilities).
function modalityBadges(model: LLMModel): string[] {
  const modalities = new Set([
    ...(model.capabilities?.inputModalities || []),
    ...(model.capabilities?.outputModalities || []),
  ]);
  modalities.delete("text");
  return [...modalities].map((m) => MODALITY_LABELS[m] || m);
}

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
      <label className="block text-sm font-medium text-white/50 mb-1">{label}</label>
      <input
        type="text"
        placeholder="Search models..."
        value={searchQuery}
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm placeholder-white/30 focus:outline-none focus:border-primary-500"
        onChange={(event) => onSearchQueryChange(event.target.value)}
      />
      <div className="max-h-64 overflow-y-auto border border-white/10 rounded-lg bg-[#1a1a24]">
        {options.length === 0 ? (
          <p className="px-3 py-2 text-sm text-white/40">No models found</p>
        ) : (
          options.map((model) => {
            const isSelected = selected?.id === model.id;
            const description = truncateDescription(model.description, 2);
            const badges = modalityBadges(model);
            return (
              <div
                key={model.id}
                className={`px-3 py-2 border-b border-white/5 last:border-b-0 ${isSelected ? "bg-primary-500/10" : "hover:bg-white/5"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm text-white truncate">{model.name}</p>
                      {badges.map((badge) => (
                        <span
                          key={badge}
                          className="shrink-0 rounded-full border border-primary-400/30 bg-primary-400/10 px-1.5 py-0.5 text-[10px] font-medium text-primary-300"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-white/40 font-mono truncate">{model.id}</p>
                    <p className="text-[11px] text-white/50 mt-0.5">
                      In: {formatPrice(model.pricing.prompt)} · Out: {formatPrice(model.pricing.completion)}
                    </p>
                    {description.text && (
                      <p className="text-[11px] text-white/35 mt-0.5 leading-snug">{description.text}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {onReadMore && (
                      <button
                        type="button"
                        onClick={() => onReadMore(model)}
                        className="text-sm text-primary-400 hover:text-primary-300"
                      >
                        Read more
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelect(model)}
                      className={`text-sm px-2 py-1 rounded ${isSelected ? "bg-primary-500 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"}`}
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
