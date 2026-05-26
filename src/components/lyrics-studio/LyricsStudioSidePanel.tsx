"use client";

import Flowchart from "@/components/Flowchart";
import type { LyricBlock } from "@/lib/lyrics-utils";

type LyricsStudioSidePanelProps = {
  blocks: LyricBlock[];
  topic: string;
  mood: string;
  style: string;
  combinedLyrics: string;
  styleSuggestion: string;
  generatingStyleSuggestion: boolean;
  copiedStyleSuggestion: boolean;
  onGenerateStyleSuggestion: () => void;
  onStyleSuggestionChange: (value: string) => void;
  onCopyStyleSuggestion: () => void;
  onUseLyricsAndStyleInStudio: () => void;
};

export default function LyricsStudioSidePanel({
  blocks,
  topic,
  mood,
  style,
  combinedLyrics,
  styleSuggestion,
  generatingStyleSuggestion,
  copiedStyleSuggestion,
  onGenerateStyleSuggestion,
  onStyleSuggestionChange,
  onCopyStyleSuggestion,
  onUseLyricsAndStyleInStudio,
}: LyricsStudioSidePanelProps) {
  return (
    <aside className="hidden lg:block">
      <div className="flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-[#181820]/80 p-4">
        <div className="min-h-[220px] rounded-xl border border-white/10 bg-[#11111a] p-3">
          <h3 className="mb-3 text-sm font-semibold text-white/60">Song Flow</h3>
          <div className="h-[calc(100%-1.75rem)] overflow-auto">
            <Flowchart blocks={blocks.map((block) => ({ label: block.label, type: block.type }))} />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#11111a] p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white/70">Style Suggestion</h3>
            <button
              type="button"
              onClick={onGenerateStyleSuggestion}
              disabled={!topic.trim() || !mood.trim() || !combinedLyrics.trim() || generatingStyleSuggestion}
              className="inline-flex items-center justify-center rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-40"
              title="Generate style suggestion from topic, mood and lyrics"
            >
              {generatingStyleSuggestion ? "Generating..." : "AI Fill"}
            </button>
          </div>

          <textarea
            value={styleSuggestion}
            onChange={(event) => onStyleSuggestionChange(event.target.value)}
            placeholder="AI style suggestion will appear here"
            className="min-h-[120px] w-full resize-y rounded-xl border border-white/10 bg-[#0f0f16] px-3 py-2 text-xs leading-5 text-white/90 outline-none transition placeholder:text-white/25 focus:border-primary-500/60"
          />

          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-white/35">Based on topic, mood and current lyrics.</p>
            <button
              type="button"
              onClick={onCopyStyleSuggestion}
              disabled={!styleSuggestion.trim()}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
            >
              {copiedStyleSuggestion ? "Copied" : "Copy"}
            </button>
          </div>

          <button
            type="button"
            onClick={onUseLyricsAndStyleInStudio}
            disabled={!combinedLyrics.trim() || !(styleSuggestion.trim() || style.trim())}
            className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-primary-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-40"
            title="Copy lyrics and style to Studio"
          >
            Use lyrics + style in Studio
          </button>
        </div>
      </div>
    </aside>
  );
}
