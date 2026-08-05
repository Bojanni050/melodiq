"use client";

import React, { useState } from "react";
import type { LyricLine } from "@/lib/timecoded-editor/LyricsParser";
import type { AILinePatch } from "@/lib/timecoded-editor/LyricsValidator";

interface DiffViewerProps {
  isOpen: boolean;
  originalLines: LyricLine[];
  patch: AILinePatch[];
  actionLabel: string;
  onApplyAll: () => void;
  onApplySelected: (selectedIds: Set<number>) => void;
  onReject: () => void;
}

export default function DiffViewer({
  isOpen,
  originalLines,
  patch,
  actionLabel,
  onApplyAll,
  onApplySelected,
  onReject,
}: DiffViewerProps) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(patch.map((p) => p.lineId))
  );

  if (!isOpen || patch.length === 0) return null;

  // Build a lookup: lineId → original text
  const originalMap = new Map(originalLines.map((l) => [l.id, l]));

  // Only show lines that actually changed
  const changedPatch = patch.filter((p) => {
    const orig = originalMap.get(p.lineId);
    return orig && orig.text !== p.text;
  });

  // Lines that the AI returned but unchanged
  const unchangedCount = patch.length - changedPatch.length;

  function toggleLine(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === changedPatch.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(changedPatch.map((p) => p.lineId)));
    }
  }

  return (
    <div className="tce-diff-overlay" role="dialog" aria-modal="true" aria-label="AI Edit Preview">
      <div className="tce-diff-modal">
        <div className="tce-diff-header">
          <div className="tce-diff-title">
            <span className="tce-ai-icon">✦</span>
            AI Preview — {actionLabel}
          </div>
          <div className="tce-diff-summary">
            {changedPatch.length} line{changedPatch.length !== 1 ? "s" : ""} changed
            {unchangedCount > 0 ? `, ${unchangedCount} unchanged` : ""}
          </div>
        </div>

        {changedPatch.length === 0 ? (
          <div className="tce-diff-empty">
            No changes — the AI found nothing to fix.
          </div>
        ) : (
          <>
            <div className="tce-diff-controls">
              <label className="tce-opt-label">
                <input
                  type="checkbox"
                  checked={selected.size === changedPatch.length}
                  onChange={toggleAll}
                  id="tce-diff-select-all"
                />
                Select all
              </label>
              <span className="tce-diff-selected">
                {selected.size} of {changedPatch.length} selected
              </span>
            </div>

            <div className="tce-diff-list">
              {changedPatch.map((p) => {
                const orig = originalMap.get(p.lineId)!;
                const isSelected = selected.has(p.lineId);
                return (
                  <div
                    key={p.lineId}
                    className={`tce-diff-item${isSelected ? " tce-diff-item--selected" : ""}`}
                    onClick={() => toggleLine(p.lineId)}
                  >
                    <div className="tce-diff-item__check">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleLine(p.lineId)}
                        id={`tce-diff-${p.lineId}`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="tce-diff-item__ts">
                      <span>{orig.timestamp}</span>
                    </div>
                    <div className="tce-diff-item__content">
                      <div className="tce-diff-before">
                        <span className="tce-diff-label tce-diff-label--before">Before</span>
                        <span className="tce-diff-text tce-diff-text--before">{orig.text || <em>empty</em>}</span>
                      </div>
                      <div className="tce-diff-after">
                        <span className="tce-diff-label tce-diff-label--after">After</span>
                        <span className="tce-diff-text tce-diff-text--after">{p.text || <em>empty</em>}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="tce-diff-footer">
          <button
            className="tce-btn-reject"
            onClick={onReject}
            id="tce-diff-reject"
          >
            Reject all
          </button>
          <button
            className="tce-btn-apply-selected"
            onClick={() => onApplySelected(selected)}
            disabled={selected.size === 0}
            id="tce-diff-apply-selected"
          >
            Apply selected ({selected.size})
          </button>
          <button
            className="tce-btn-apply-all btn-primary"
            onClick={onApplyAll}
            id="tce-diff-apply-all"
          >
            Apply all
          </button>
        </div>
      </div>
    </div>
  );
}
