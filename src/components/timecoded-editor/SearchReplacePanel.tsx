"use client";

import React, { useEffect, useRef, useState } from "react";
import type { SearchMatch } from "@/lib/timecoded-editor/SearchService";

interface SearchReplacePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string, options: { caseSensitive: boolean; useRegex: boolean }) => SearchMatch[];
  onReplace: (match: SearchMatch, replacement: string) => void;
  onReplaceAll: (query: string, replacement: string, options: { caseSensitive: boolean; useRegex: boolean }) => void;
  totalLines: number;
}

export default function SearchReplacePanel({
  isOpen,
  onClose,
  onSearch,
  onReplace,
  onReplaceAll,
  totalLines,
}: SearchReplacePanelProps) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showReplace, setShowReplace] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query) {
      setMatches([]);
      setCurrentIdx(0);
      return;
    }
    const found = onSearch(query, { caseSensitive, useRegex });
    setMatches(found);
    setCurrentIdx(0);
  }, [query, caseSensitive, useRegex, onSearch, totalLines]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "Enter" && !e.shiftKey) { goNext(); return; }
    if (e.key === "Enter" && e.shiftKey) { goPrev(); return; }
  }

  function goNext() {
    if (matches.length === 0) return;
    setCurrentIdx((i) => (i + 1) % matches.length);
  }
  function goPrev() {
    if (matches.length === 0) return;
    setCurrentIdx((i) => (i - 1 + matches.length) % matches.length);
  }

  function handleReplace() {
    if (matches.length === 0) return;
    const match = matches[currentIdx];
    onReplace(match, replacement);
    // Re-run search after replace
    const found = onSearch(query, { caseSensitive, useRegex });
    setMatches(found);
    setCurrentIdx((i) => Math.min(i, Math.max(found.length - 1, 0)));
  }

  function handleReplaceAll() {
    onReplaceAll(query, replacement, { caseSensitive, useRegex });
    setMatches([]);
    setCurrentIdx(0);
  }

  if (!isOpen) return null;

  return (
    <div
      className="tce-search-panel"
      role="dialog"
      aria-label="Search and Replace"
      onKeyDown={handleKeyDown}
    >
      <div className="tce-search-panel__header">
        <span className="tce-search-panel__title">
          {showReplace ? "Search & Replace" : "Search"}
        </span>
        <button
          className="tce-icon-btn"
          onClick={() => setShowReplace((v) => !v)}
          aria-label={showReplace ? "Hide replace" : "Show replace"}
          title={showReplace ? "Hide replace" : "Show replace"}
        >
          {showReplace ? "▴" : "▾"}
        </button>
        <button
          className="tce-icon-btn"
          onClick={onClose}
          aria-label="Close search panel"
          title="Close (Esc)"
          id="tce-search-close"
        >
          ✕
        </button>
      </div>

      <div className="tce-search-row">
        <input
          ref={inputRef}
          id="tce-search-input"
          className="tce-search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search lyrics..."
          aria-label="Search lyrics"
          autoComplete="off"
        />
        <button
          className="tce-nav-btn"
          onClick={goPrev}
          disabled={matches.length === 0}
          aria-label="Previous match"
          title="Previous (Shift+Enter)"
        >▲</button>
        <button
          className="tce-nav-btn"
          onClick={goNext}
          disabled={matches.length === 0}
          aria-label="Next match"
          title="Next (Enter)"
        >▼</button>
        <span className="tce-match-count" aria-live="polite">
          {matches.length > 0
            ? `${currentIdx + 1} / ${matches.length}`
            : query
            ? "0 matches"
            : ""}
        </span>
      </div>

      {/* Options */}
      <div className="tce-search-options">
        <label className="tce-opt-label">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
            id="tce-opt-case"
          />
          Aa
        </label>
        <label className="tce-opt-label">
          <input
            type="checkbox"
            checked={useRegex}
            onChange={(e) => setUseRegex(e.target.checked)}
            id="tce-opt-regex"
          />
          .*
        </label>
      </div>

      {showReplace && (
        <div className="tce-replace-row">
          <input
            id="tce-replace-input"
            className="tce-search-input"
            type="text"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder="Replace with..."
            aria-label="Replace with"
          />
          <button
            className="tce-nav-btn"
            onClick={handleReplace}
            disabled={matches.length === 0}
            aria-label="Replace current match"
            title="Replace"
            id="tce-btn-replace"
          >
            Replace
          </button>
          <button
            className="tce-nav-btn tce-nav-btn--danger"
            onClick={handleReplaceAll}
            disabled={matches.length === 0}
            aria-label="Replace all matches"
            title="Replace all"
            id="tce-btn-replace-all"
          >
            All
          </button>
        </div>
      )}
    </div>
  );
}
