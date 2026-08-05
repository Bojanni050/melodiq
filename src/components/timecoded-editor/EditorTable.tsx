"use client";

import React, { useCallback, useRef } from "react";
import EditorRow from "./EditorRow";
import type { LyricLine } from "@/lib/timecoded-editor/LyricsParser";
import type { SearchMatch } from "@/lib/timecoded-editor/SearchService";

interface EditorTableProps {
  lines: LyricLine[];
  activeLineId: number | null;
  selectedIds: Set<number>;
  dirtyIds: Set<number>;
  searchMatches: SearchMatch[];
  activeMatchLineId: number | null;
  onTextChange: (id: number, text: string) => void;
  onActivate: (id: number) => void;
  onToggleSelect: (id: number, e: React.MouseEvent) => void;
}

export default function EditorTable({
  lines,
  activeLineId,
  selectedIds,
  dirtyIds,
  searchMatches,
  activeMatchLineId,
  onTextChange,
  onActivate,
  onToggleSelect,
}: EditorTableProps) {
  // Map from lineId → array of matches in that line
  const matchesByLine = React.useMemo(() => {
    const map = new Map<number, SearchMatch[]>();
    for (const m of searchMatches) {
      if (!map.has(m.lineId)) map.set(m.lineId, []);
      map.get(m.lineId)!.push(m);
    }
    return map;
  }, [searchMatches]);

  // Textarea refs for keyboard navigation
  const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());

  const setRef = useCallback((id: number) => (el: HTMLTextAreaElement | null) => {
    if (el) textareaRefs.current.set(id, el);
    else textareaRefs.current.delete(id);
  }, []);

  function focusLine(id: number) {
    const el = textareaRefs.current.get(id);
    if (el) el.focus();
  }

  function handleFocus(id: number) {
    onActivate(id);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!activeLineId) return;
    const idx = lines.findIndex((l) => l.id === activeLineId);
    if (idx < 0) return;

    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const next = lines[idx + 1];
      if (next) focusLine(next.id);
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      const prev = lines[idx - 1];
      if (prev) focusLine(prev.id);
    } else if (e.key === "ArrowDown" && e.altKey) {
      e.preventDefault();
      const next = lines[idx + 1];
      if (next) focusLine(next.id);
    } else if (e.key === "ArrowUp" && e.altKey) {
      e.preventDefault();
      const prev = lines[idx - 1];
      if (prev) focusLine(prev.id);
    }
  }

  if (lines.length === 0) {
    return (
      <div className="tce-table-empty">
        <div className="tce-table-empty__icon">🎵</div>
        <div className="tce-table-empty__text">No lyrics loaded yet.</div>
        <div className="tce-table-empty__sub">Import a timecoded lyrics file above to get started.</div>
      </div>
    );
  }

  return (
    <div
      className="tce-table"
      onKeyDown={handleKeyDown}
      role="grid"
      aria-label="Timecoded lyrics editor"
      aria-rowcount={lines.length}
    >
      {/* Header */}
      <div className="tce-table-header" role="row">
        <div className="tce-table-header__ts" role="columnheader" aria-label="Timestamp (locked)">
          🔒 Timestamp
        </div>
        <div className="tce-table-header__text" role="columnheader">
          Lyric Text
        </div>
      </div>

      {/* Rows */}
      <div className="tce-table-body">
        {lines.map((line, idx) => (
          <EditorRow
            key={line.id}
            line={line}
            isActive={line.id === activeLineId}
            isSelected={selectedIds.has(line.id)}
            isDirty={dirtyIds.has(line.id)}
            searchMatches={matchesByLine.get(line.id) ?? []}
            activeMatchLineId={activeMatchLineId}
            onTextChange={onTextChange}
            onFocus={handleFocus}
            onClick={onToggleSelect}
            textareaRef={setRef(line.id)}
            aria-rowindex={idx + 1}
          />
        ))}
      </div>
    </div>
  );
}
