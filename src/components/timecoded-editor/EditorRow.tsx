"use client";

import React from "react";
import type { LyricLine } from "@/lib/timecoded-editor/LyricsParser";
import type { SearchMatch } from "@/lib/timecoded-editor/SearchService";

interface EditorRowProps {
  line: LyricLine;
  isActive: boolean;
  isSelected: boolean;
  isDirty: boolean;
  /** True when this line's word-level timing was cleared because its text changed. */
  wordTimingCleared?: boolean;
  searchMatches: SearchMatch[];
  /** lineId of the currently focused search match (for highlighting) */
  activeMatchLineId: number | null;
  onTextChange: (id: number, text: string) => void;
  onFocus: (id: number) => void;
  onClick: (id: number, e: React.MouseEvent) => void;
  textareaRef?: (el: HTMLTextAreaElement | null) => void;
  "aria-rowindex"?: number;
}

function highlightText(
  text: string,
  matches: SearchMatch[],
  activeLineId: number | null,
  lineId: number
): React.ReactNode {
  if (matches.length === 0) return text;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  const isActive = activeLineId === lineId;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (m.start > cursor) {
      parts.push(text.slice(cursor, m.start));
    }
    parts.push(
      <mark
        key={i}
        className={isActive && i === 0 ? "tce-match-active" : "tce-match"}
      >
        {text.slice(m.start, m.end)}
      </mark>
    );
    cursor = m.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

export default function EditorRow({
  line,
  isActive,
  isSelected,
  isDirty,
  wordTimingCleared,
  searchMatches,
  activeMatchLineId,
  onTextChange,
  onFocus,
  onClick,
  textareaRef,
}: EditorRowProps) {
  const hasMatches = searchMatches.length > 0;

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const el = e.target;
    // Auto-grow
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    onTextChange(line.id, el.value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      // Focus next/prev row handled by parent via onFocus
    }
  }

  return (
    <div
      className={`tce-row${isActive ? " tce-row--active" : ""}${isSelected ? " tce-row--selected" : ""}${hasMatches ? " tce-row--match" : ""}`}
      onClick={(e) => onClick(line.id, e)}
      data-line-id={line.id}
      aria-selected={isSelected}
    >
      {/* Timestamp — completely locked */}
      <div
        className="tce-timestamp"
        aria-label="Locked timestamp"
        title="Timestamp — locked"
        aria-readonly="true"
      >
        <span className="tce-lock-icon">🔒</span>
        <span className="tce-timestamp-value">{line.timestamp}</span>
      </div>

      {/* Lyric text — editable */}
      <div className="tce-text-cell">
        {hasMatches && (
          <div className="tce-text-highlight" aria-hidden="true">
            {highlightText(line.text, searchMatches, activeMatchLineId, line.id)}
          </div>
        )}
        <textarea
          ref={textareaRef}
          id={`lyric-line-${line.id}`}
          className="tce-textarea"
          value={line.text}
          onChange={handleInput}
          onFocus={() => onFocus(line.id)}
          onKeyDown={handleKeyDown}
          rows={1}
          spellCheck
          aria-label={`Lyric line ${line.id} at ${line.timestamp}`}
          data-line-id={line.id}
        />
        {isDirty && (
          <span className="tce-dirty-dot" title="Unsaved changes" aria-label="Unsaved" />
        )}
        {wordTimingCleared && (
          <span
            className="tce-word-timing-cleared"
            title="Word-level timing cleared for this line — text was edited since alignment"
            aria-label="Word timing cleared"
          >
            ⚠ word timing cleared
          </span>
        )}
      </div>
    </div>
  );
}
