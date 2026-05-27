"use client";

import type { BlockType, LyricBlock } from "@/lib/lyrics-utils";

export default function LyricBlockEditor({
  blocks,
  lyricCols,
  setLyricCols,
  blockColors,
  blockLabels,
  draggedBlockId,
  dropTarget,
  canGenerateBlocks,
  translatingBlockId,
  effectiveTranslationLanguage,
  onStartBlockDrag,
  onStartBlockDragFromCard,
  onStartBlockMouseDrag,
  onBlockMouseDragOver,
  onBlockMouseDrop,
  onBlockMouseDragEnd,
  onMoveBlock,
  onDuplicateBlock,
  onDeleteBlock,
  onUpdateBlock,
  onGenerateBlock,
  onTranslateBlock,
  autoGrowTextarea,
}: {
  blocks: LyricBlock[];
  lyricCols: number;
  setLyricCols: (cols: number) => void;
  blockColors: Record<BlockType, string>;
  blockLabels: Record<BlockType, string>;
  draggedBlockId: string | null;
  dropTarget: { id: string; position: "before" | "after" } | null;
  canGenerateBlocks: boolean;
  translatingBlockId: string | null;
  effectiveTranslationLanguage: string;
  onStartBlockDrag: (event: React.PointerEvent<HTMLButtonElement>, blockId: string) => void;
  onStartBlockDragFromCard: (event: React.PointerEvent<HTMLElement>, blockId: string) => void;
  onStartBlockMouseDrag: (event: React.DragEvent<HTMLElement>, blockId: string) => void;
  onBlockMouseDragOver: (event: React.DragEvent<HTMLElement>, blockId: string) => void;
  onBlockMouseDrop: (event: React.DragEvent<HTMLElement>, blockId: string) => void;
  onBlockMouseDragEnd: () => void;
  onMoveBlock: (id: string, direction: -1 | 1) => void;
  onDuplicateBlock: (id: string) => void;
  onDeleteBlock: (id: string) => void;
  onUpdateBlock: (id: string, patch: Partial<LyricBlock>) => void;
  onGenerateBlock: (block: LyricBlock) => void;
  onTranslateBlock: (id: string) => void;
  autoGrowTextarea: (element: HTMLTextAreaElement) => void;
}) {
  return (
    <>
      <div className="flex justify-end mb-2">
        <label className="flex items-center gap-2 text-xs text-white/50 select-none">
          <input
            type="radio"
            name="lyric-cols"
            checked={lyricCols === 1}
            onChange={() => setLyricCols(1)}
          />
          1 kolom
        </label>
        <label className="flex items-center gap-2 ml-4 text-xs text-white/50 select-none">
          <input
            type="radio"
            name="lyric-cols"
            checked={lyricCols === 2}
            onChange={() => setLyricCols(2)}
          />
          2 kolommen
        </label>
      </div>

      {blocks.length === 0 ? (
        <div className="flex min-h-[460px] items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-center">
          <p className="text-sm text-white/40">Add your first block to get started</p>
        </div>
      ) : (
        <div className={`grid gap-4 ${lyricCols === 1 ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}>
          {blocks.map((block, index) => {
            const isDragged = draggedBlockId === block.id;
            const showDropBefore = dropTarget?.id === block.id && dropTarget.position === "before";
            const showDropAfter = dropTarget?.id === block.id && dropTarget.position === "after";

            return (
              <article
                key={block.id}
                data-lyric-block-id={block.id}
                aria-grabbed={draggedBlockId === block.id}
                onPointerDown={(event) => onStartBlockDragFromCard(event, block.id)}
                draggable
                onDragStart={(event) => onStartBlockMouseDrag(event, block.id)}
                onDragOver={(event) => onBlockMouseDragOver(event, block.id)}
                onDrop={(event) => onBlockMouseDrop(event, block.id)}
                onDragEnd={onBlockMouseDragEnd}
                className={`relative rounded-xl border border-white/10 bg-[#15151f] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.18)] flex flex-col transition touch-none cursor-grab active:cursor-grabbing select-none ${isDragged ? "opacity-55 scale-[0.985]" : ""}`}
                style={{ borderLeft: `4px solid ${blockColors[block.type]}` }}
                title="Drag to reorder"
              >
                {showDropBefore && <div className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary-400" />}
                <div className="mb-3 flex flex-wrap items-center gap-2 select-none">
                  <button
                    type="button"
                    onPointerDown={(event) => onStartBlockDrag(event, block.id)}
                    draggable
                    aria-label={`Drag ${block.label || blockLabels[block.type]} block`}
                    onDragStart={(event) => onStartBlockMouseDrag(event, block.id)}
                    className="h-11 w-11 shrink-0 rounded-lg border border-white/10 text-white/45 transition hover:bg-white/10 hover:text-white cursor-grab active:cursor-grabbing touch-none"
                    title="Drag to reorder"
                  >
                    <svg className="mx-auto h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 6h.01M10 12h.01M10 18h.01M14 6h.01M14 12h.01M14 18h.01" />
                    </svg>
                  </button>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-white/25">Drag to reorder</div>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white"
                    style={{ backgroundColor: blockColors[block.type] }}
                  >
                    {blockLabels[block.type]}
                  </span>
                  <input
                    type="text"
                    value={block.label}
                    onChange={(event) => onUpdateBlock(block.id, { label: event.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-primary-500/60"
                    aria-label={`${blockLabels[block.type]} label`}
                  />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onMoveBlock(block.id, -1)}
                      disabled={index === 0}
                      className="h-9 w-9 rounded-lg border border-white/10 text-white/45 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveBlock(block.id, 1)}
                      disabled={index === blocks.length - 1}
                      className="h-9 w-9 rounded-lg border border-white/10 text-white/45 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicateBlock(block.id)}
                      className="h-9 w-9 rounded-lg border border-white/10 text-white/45 transition hover:bg-white/10 hover:text-white"
                      title="Duplicate block"
                    >
                      <svg className="mx-auto h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteBlock(block.id)}
                      className="h-9 w-9 rounded-lg border border-white/10 text-white/45 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-200"
                      title="Delete block"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {block.type === "chorus" && (
                  <label className="mb-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75">
                    <input
                      type="checkbox"
                      checked={block.uniqueChorusOverride}
                      onChange={(event) => onUpdateBlock(block.id, { uniqueChorusOverride: event.target.checked })}
                    />
                    Unique chorus override
                  </label>
                )}

                <textarea
                  value={block.content}
                  disabled={block.generating}
                  onInput={(event) => autoGrowTextarea(event.currentTarget)}
                  onChange={(event) => onUpdateBlock(block.id, { content: event.target.value })}
                  placeholder="Lyrics will appear here..."
                  rows={4}
                  className="min-h-[112px] w-full resize-y rounded-xl border border-white/10 bg-[#0f0f16] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-primary-500/60 disabled:cursor-wait disabled:opacity-60"
                  style={{ overflow: "auto" }}
                />

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onGenerateBlock(block)}
                      disabled={block.generating || !canGenerateBlocks}
                      title={canGenerateBlocks ? "Generate block" : "Add topic and mood first"}
                      className="inline-flex min-w-[118px] items-center justify-center rounded-lg bg-primary-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-400 disabled:cursor-not-allowed disabled:bg-primary-500/50"
                    >
                      {block.generating ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : (
                        "✨ Generate"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onTranslateBlock(block.id)}
                      disabled={translatingBlockId === block.id || !block.content.trim() || !effectiveTranslationLanguage.trim()}
                      title={block.content.trim() ? "Translate this block" : "Add content to translate"}
                      className="inline-flex items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {translatingBlockId === block.id ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200/30 border-t-blue-200" />
                      ) : (
                        "🌐"
                      )}
                    </button>
                  </div>
                  <span className="text-xs text-white/35">{block.content.length} chars</span>
                </div>
                {showDropAfter && <div className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary-400" />}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
