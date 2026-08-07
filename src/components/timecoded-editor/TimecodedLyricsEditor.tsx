"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { parseLyrics, type LyricLine } from "@/lib/timecoded-editor/LyricsParser";
import { serializeLyrics } from "@/lib/timecoded-editor/LyricsSerializer";
import { tclToLyricLines, lyricLinesToTcl } from "@/lib/timecoded-editor/TclConverters";
import type { TclDocument } from "@/lib/tcl/types";
import {
  validatePatch,
  applyPatch,
  type AILinePatch,
  ValidationError,
} from "@/lib/timecoded-editor/LyricsValidator";
import { HistoryManager } from "@/lib/timecoded-editor/HistoryManager";
import {
  search,
  replace,
  replaceAll,
  type SearchMatch,
  type SearchOptions,
} from "@/lib/timecoded-editor/SearchService";

import AIToolbar, { type AIEditAction } from "./AIToolbar";
import DiffViewer from "./DiffViewer";
import EditorTable from "./EditorTable";
import ExportPanel from "./ExportPanel";
import ImportPanel from "./ImportPanel";
import SearchReplacePanel from "./SearchReplacePanel";
import WaveformPanel from "./WaveformPanel";

const AUTOSAVE_KEY = "melodiq-tce-draft";
const AUTOSAVE_DELAY = 1200;

interface TimecodedLyricsEditorProps {
  /** If provided, the editor loads this track's lyricsTimestamps and can save back */
  trackId?: string;
  /** Pre-loaded raw timecoded lyrics (from a track row) — ignored when tclDocument is provided */
  initialRaw?: string;
  /** Forced-alignment result for this track — enables waveform playback + word-level exports */
  tclDocument?: TclDocument;
  /** Presigned audio URL for the track, required for the waveform panel */
  audioUrl?: string;
}

type Toast = { id: string; type: "success" | "error" | "info" | "warning"; message: string };

// ─────────────────────────────────────────────────────────────
// History singleton (lives outside React to avoid re-creation)
// ─────────────────────────────────────────────────────────────
const history = new HistoryManager();

export default function TimecodedLyricsEditor({
  trackId,
  initialRaw,
  tclDocument,
  audioUrl,
}: TimecodedLyricsEditorProps) {
  // The alignment result never changes for the lifetime of this session —
  // only used as the "original" reference for word-timing preservation.
  const originalTclDocRef = useRef<TclDocument | undefined>(tclDocument);

  // ── Core state ──────────────────────────────────────────────
  const [lines, setLines] = useState<LyricLine[]>(() => {
    if (tclDocument) {
      return tclToLyricLines(tclDocument);
    }
    if (initialRaw) {
      try { return parseLyrics(initialRaw); } catch { /* ignore */ }
    }
    // Restore from autosave if no initial data
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(AUTOSAVE_KEY);
        if (saved) return parseLyrics(saved);
      } catch { /* ignore */ }
    }
    return [];
  });

  const [originalLines, setOriginalLines] = useState<LyricLine[]>(lines);

  // ── Live TCL doc (recomputed from `lines`) — feeds the waveform panel,
  // word-level exports, and the "word timing cleared" badges. ──────────
  const { doc: liveTclDoc, dirtyLineIds: wordTimingClearedIds } = useMemo(() => {
    if (!originalTclDocRef.current) {
      return { doc: undefined as TclDocument | undefined, dirtyLineIds: new Set<number>() };
    }
    return lyricLinesToTcl(lines, originalTclDocRef.current);
  }, [lines]);
  const [activeLineId, setActiveLineId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set());

  // ── UI state ────────────────────────────────────────────────
  const [showImport, setShowImport] = useState(lines.length === 0);
  const [showSearch, setShowSearch] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [isSavingToTrack, setIsSavingToTrack] = useState(false);

  // ── AI state ────────────────────────────────────────────────
  const [isAILoading, setIsAILoading] = useState(false);
  const [pendingPatch, setPendingPatch] = useState<AILinePatch[] | null>(null);
  const [pendingActionLabel, setPendingActionLabel] = useState("");

  // ── Search state ────────────────────────────────────────────
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [activeMatchLineId, setActiveMatchLineId] = useState<number | null>(null);

  // ── History state (triggers re-render) ─────────────────────
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Undo/Redo helpers ────────────────────────────────────────
  const commitHistory = useCallback((newLines: LyricLine[], currentLines: LyricLine[]) => {
    history.push(currentLines);
    setCanUndo(history.canUndo);
    setCanRedo(history.canRedo);
    return newLines;
  }, []);

  // ── Auto-save ────────────────────────────────────────────────
  function scheduleAutosave(newLines: LyricLine[]) {
    setSaveStatus("unsaved");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      try {
        const serialized = serializeLyrics(newLines);
        localStorage.setItem(AUTOSAVE_KEY, serialized);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("unsaved");
      }
    }, AUTOSAVE_DELAY);
  }

  // ── Toast helpers ────────────────────────────────────────────
  function toast(type: Toast["type"], message: string) {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }

  // ── Text change ───────────────────────────────────────────────
  const handleTextChange = useCallback((id: number, text: string) => {
    setLines((prev) => {
      const updated = prev.map((l) => (l.id === id ? { ...l, text } : l));
      scheduleAutosave(updated);
      return updated;
    });
    setDirtyIds((prev) => new Set([...prev, id]));
  }, []);

  // ── Selection ────────────────────────────────────────────────
  const handleToggleSelect = useCallback((id: number, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setSelectedIds(new Set([id]));
    }
    setActiveLineId(id);
  }, []);

  // ── Import ───────────────────────────────────────────────────
  function handleImport(newLines: LyricLine[]) {
    history.clear();
    setCanUndo(false);
    setCanRedo(false);
    setLines(newLines);
    setOriginalLines(newLines);
    setDirtyIds(new Set());
    setSelectedIds(new Set());
    setActiveLineId(null);
    setShowImport(false);
    scheduleAutosave(newLines);
    toast("success", `Loaded ${newLines.length} lines`);
  }

  // ── Keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
      if (ctrl && e.key === "y") { e.preventDefault(); handleRedo(); }
      if (ctrl && e.key === "f") { e.preventDefault(); setShowSearch((v) => !v); }
      if (ctrl && e.key === "h") { e.preventDefault(); setShowSearch(true); }
      if (ctrl && e.key === "s") { e.preventDefault(); forceSave(); }
      if (ctrl && e.key === "a") {
        e.preventDefault();
        setSelectedIds(new Set(lines.map((l) => l.id)));
      }
      if (e.key === "Escape") {
        setShowSearch(false);
        setSelectedIds(new Set());
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lines]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleUndo() {
    setLines((prev) => {
      const result = history.undo(prev);
      if (!result) return prev;
      setCanUndo(history.canUndo);
      setCanRedo(history.canRedo);
      scheduleAutosave(result);
      setDirtyIds(new Set());
      return result;
    });
  }

  function handleRedo() {
    setLines((prev) => {
      const result = history.redo(prev);
      if (!result) return prev;
      setCanUndo(history.canUndo);
      setCanRedo(history.canRedo);
      scheduleAutosave(result);
      return result;
    });
  }

  function forceSave() {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    try {
      setSaveStatus("saving");
      const serialized = serializeLyrics(lines);
      localStorage.setItem(AUTOSAVE_KEY, serialized);
      setSaveStatus("saved");
      toast("success", "Saved locally");
    } catch {
      setSaveStatus("unsaved");
    }
  }

  // ── Save to track ─────────────────────────────────────────────
  async function handleSaveToTrack() {
    if (!trackId) return;
    setIsSavingToTrack(true);
    try {
      const usesTcl = !!originalTclDocRef.current;
      const res = await fetch(usesTcl ? "/api/timecoded-editor/save-tcl" : "/api/timecoded-editor/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          usesTcl
            ? { trackId, tcl: liveTclDoc }
            : { trackId, lyricsTimestamps: serializeLyrics(lines) }
        ),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast("error", (err as Record<string, string>).error || "Failed to save to track");
      } else {
        setDirtyIds(new Set());
        toast("success", "Saved to track ✓");
      }
    } catch {
      toast("error", "Network error — could not save to track");
    } finally {
      setIsSavingToTrack(false);
    }
  }

  // ── AI actions ────────────────────────────────────────────────
  async function handleAIAction(
    action: AIEditAction,
    opts: { scope: "all" | "selection"; language?: string }
  ) {
    if (isAILoading) return;

    const scopeLines =
      opts.scope === "selection" && selectedIds.size > 0
        ? lines.filter((l) => selectedIds.has(l.id))
        : lines;

    if (scopeLines.length === 0) {
      toast("warning", "No lines to process");
      return;
    }

    // Strip timestamps — AI only sees {lineId, text}
    const payload = scopeLines.map((l) => ({ lineId: l.id, text: l.text }));

    setIsAILoading(true);
    try {
      const res = await fetch("/api/timecoded-editor/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          lines: payload,
          language: opts.language,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast("error", (err as Record<string, string>).error || "AI request failed");
        return;
      }

      const data = await res.json() as { patch: unknown };

      // Validate before showing diff
      let validatedPatch: AILinePatch[];
      try {
        validatedPatch = validatePatch(data.patch, lines);
      } catch (e) {
        toast("error", e instanceof ValidationError ? e.message : "AI returned invalid data");
        return;
      }

      const ACTION_LABELS: Record<AIEditAction, string> = {
        spelling: "Correct Spelling",
        grammar: "Fix Grammar",
        phonetic: "Phonetic Repair",
        translate: `Translate → ${opts.language || "English"}`,
        readability: "Improve Readability",
      };

      setPendingPatch(validatedPatch);
      setPendingActionLabel(ACTION_LABELS[action]);
    } catch {
      toast("error", "AI request failed — check your connection");
    } finally {
      setIsAILoading(false);
    }
  }

  function applyPatchToLines(patchToApply: AILinePatch[]) {
    if (patchToApply.length === 0) return;
    setLines((prev) => {
      const next = applyPatch(prev, patchToApply);
      commitHistory(next, prev);
      setDirtyIds((d) => {
        const n = new Set(d);
        patchToApply.forEach((p) => n.add(p.lineId));
        return n;
      });
      scheduleAutosave(next);
      return next;
    });
  }

  function handleDiffApplyAll() {
    if (!pendingPatch) return;
    applyPatchToLines(pendingPatch);
    setPendingPatch(null);
    toast("success", "All AI changes applied");
  }

  function handleDiffApplySelected(selectedPatchIds: Set<number>) {
    if (!pendingPatch) return;
    const subset = pendingPatch.filter((p) => selectedPatchIds.has(p.lineId));
    applyPatchToLines(subset);
    setPendingPatch(null);
    toast("success", `${subset.length} change${subset.length !== 1 ? "s" : ""} applied`);
  }

  function handleDiffReject() {
    setPendingPatch(null);
    toast("info", "AI changes rejected — lyrics unchanged");
  }

  // ── Search ───────────────────────────────────────────────────
  const handleSearch = useCallback(
    (query: string, options: SearchOptions): SearchMatch[] => {
      const found = search(lines, query, options);
      setSearchMatches(found);
      setActiveMatchLineId(found[0]?.lineId ?? null);
      return found;
    },
    [lines]
  );

  const handleReplace = useCallback(
    (match: SearchMatch, replacement: string) => {
      setLines((prev) => {
        const next = replace(prev, match, replacement);
        commitHistory(next, prev);
        scheduleAutosave(next);
        return next;
      });
    },
    [commitHistory]
  );

  const handleReplaceAll = useCallback(
    (query: string, repl: string, options: SearchOptions) => {
      setLines((prev) => {
        const next = replaceAll(prev, query, repl, options);
        const changed = next.filter((l, i) => l.text !== prev[i].text);
        if (changed.length === 0) {
          toast("info", "No matches found");
          return prev;
        }
        commitHistory(next, prev);
        scheduleAutosave(next);
        toast("success", `Replaced ${changed.length} occurrence${changed.length !== 1 ? "s" : ""}`);
        return next;
      });
    },
    [commitHistory]
  );

  const hasLines = lines.length > 0;
  const hasSelection = selectedIds.size > 0;

  return (
    <div className="tce-root">
      {/* ── Toast stack ─────────────────────── */}
      <div className="tce-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`tce-toast tce-toast--${t.type}`}>
            <span>{t.message}</span>
            <button
              className="tce-toast__close"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Dismiss"
            >✕</button>
          </div>
        ))}
      </div>

      {/* ── Main layout ─────────────────────── */}
      <div className="tce-layout">
        {/* ── Top bar ─────────────────────── */}
        <div className="tce-topbar">
          <div className="tce-topbar__left">
            <h1 className="tce-title">
              <span className="tce-title__icon">🎵</span>
              Timecoded Lyrics Editor
            </h1>
            {trackId && (
              <span className="tce-track-badge">Track #{trackId.slice(-6)}</span>
            )}
          </div>
          <div className="tce-topbar__right">
            {/* Undo/Redo */}
            <button
              className="tce-icon-btn"
              onClick={handleUndo}
              disabled={!canUndo}
              aria-label="Undo (Ctrl+Z)"
              title="Undo (Ctrl+Z)"
              id="tce-undo"
            >↩</button>
            <button
              className="tce-icon-btn"
              onClick={handleRedo}
              disabled={!canRedo}
              aria-label="Redo (Ctrl+Y)"
              title="Redo (Ctrl+Y)"
              id="tce-redo"
            >↪</button>

            {/* Search */}
            <button
              className={`tce-icon-btn${showSearch ? " tce-icon-btn--active" : ""}`}
              onClick={() => setShowSearch((v) => !v)}
              aria-label="Search (Ctrl+F)"
              title="Search (Ctrl+F)"
              id="tce-search-toggle"
            >🔍</button>

            {/* Import / Export */}
            <button
              className="btn-ghost"
              onClick={() => setShowImport((v) => !v)}
              id="tce-import-toggle"
              aria-expanded={showImport}
            >
              {showImport ? "Hide Import" : "Import"}
            </button>

            {/* Save status */}
            <span
              className={`tce-save-status tce-save-status--${saveStatus}`}
              aria-live="polite"
            >
              {saveStatus === "saved" && "✓ Saved"}
              {saveStatus === "saving" && "Saving…"}
              {saveStatus === "unsaved" && "Unsaved"}
            </span>
          </div>
        </div>

        {/* ── Waveform panel ──────────────── */}
        {audioUrl && liveTclDoc && (
          <WaveformPanel audioUrl={audioUrl} doc={liveTclDoc} />
        )}

        {/* ── Search panel ────────────────── */}
        {showSearch && (
          <SearchReplacePanel
            isOpen={showSearch}
            onClose={() => setShowSearch(false)}
            onSearch={handleSearch}
            onReplace={handleReplace}
            onReplaceAll={handleReplaceAll}
            totalLines={lines.length}
          />
        )}

        {/* ── Import panel ────────────────── */}
        {showImport && (
          <div className="tce-import-section">
            <ImportPanel onImport={handleImport} />
          </div>
        )}

        {/* ── AI Toolbar ──────────────────── */}
        {hasLines && (
          <AIToolbar
            hasLines={hasLines}
            hasSelection={hasSelection}
            isLoading={isAILoading}
            selectionCount={selectedIds.size}
            onAction={handleAIAction}
          />
        )}

        {/* ── Editor table ────────────────── */}
        <div className="tce-editor-area">
          <EditorTable
            lines={lines}
            activeLineId={activeLineId}
            selectedIds={selectedIds}
            dirtyIds={dirtyIds}
            wordTimingClearedIds={wordTimingClearedIds}
            searchMatches={searchMatches}
            activeMatchLineId={activeMatchLineId}
            onTextChange={handleTextChange}
            onActivate={setActiveLineId}
            onToggleSelect={handleToggleSelect}
          />
        </div>

        {/* ── Export panel ────────────────── */}
        {hasLines && (
          <div className="tce-export-section">
            <ExportPanel
              lines={lines}
              trackId={trackId}
              isSaving={isSavingToTrack}
              onSaveToTrack={trackId ? handleSaveToTrack : undefined}
              tclDocument={liveTclDoc}
              wordTimingClearedIds={wordTimingClearedIds}
            />
          </div>
        )}

        {/* ── Status bar ──────────────────── */}
        {hasLines && (
          <div className="tce-statusbar" role="status">
            <span>{lines.length} lines</span>
            {hasSelection && <span>· {selectedIds.size} selected</span>}
            {dirtyIds.size > 0 && <span>· {dirtyIds.size} modified</span>}
            <span className="tce-statusbar__hint">
              Tab: next line · Ctrl+Z: undo · Ctrl+F: search · Ctrl+S: save
            </span>
          </div>
        )}
      </div>

      {/* ── Diff viewer modal ────────────── */}
      <DiffViewer
        isOpen={!!pendingPatch}
        originalLines={originalLines.length ? originalLines : lines}
        patch={pendingPatch ?? []}
        actionLabel={pendingActionLabel}
        onApplyAll={handleDiffApplyAll}
        onApplySelected={handleDiffApplySelected}
        onReject={handleDiffReject}
      />
    </div>
  );
}
