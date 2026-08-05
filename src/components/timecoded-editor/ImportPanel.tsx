"use client";

import React, { useCallback, useRef, useState } from "react";
import { parseLyrics, looksLikeTimecodedLyrics, type LyricLine } from "@/lib/timecoded-editor/LyricsParser";

interface ImportPanelProps {
  onImport: (lines: LyricLine[]) => void;
}

export default function ImportPanel({ onImport }: ImportPanelProps) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<LyricLine[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function tryParse(text: string) {
    setError(null);
    setRaw(text);
    if (!text.trim()) {
      setPreview(null);
      return;
    }
    try {
      const lines = parseLyrics(text);
      setPreview(lines);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse lyrics");
      setPreview(null);
    }
  }

  function handleFileRead(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      tryParse(text);
    };
    reader.readAsText(file, "utf-8");
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileRead(file);
  }, []);

  function handleImport() {
    if (!preview) return;
    onImport(preview);
  }

  return (
    <div className="tce-import">
      <div className="tce-import__title">
        <span>Import Timecoded Lyrics</span>
        <span className="tce-import__format">Format: <code>[MM:SS.mmm]</code></span>
      </div>

      <div
        className={`tce-drop-zone${dragOver ? " tce-drop-zone--active" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        aria-label="Drop LRC file or click to upload"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".lrc,.txt"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && handleFileRead(e.target.files[0])}
          id="tce-file-input"
        />
        <span className="tce-drop-icon">⬆</span>
        <span className="tce-drop-label">Drop .lrc / .txt file or click to upload</span>
      </div>

      <div className="tce-import__divider">— or paste —</div>

      <textarea
        id="tce-import-paste"
        className="tce-import-textarea"
        value={raw}
        onChange={(e) => tryParse(e.target.value)}
        placeholder={`[00:08.320]\nAi lav ju\n\n[00:11.240]\nAi miss ju`}
        rows={8}
        spellCheck={false}
        aria-label="Paste timecoded lyrics"
      />

      {error && (
        <div className="tce-error" role="alert">
          <span className="tce-error__icon">⚠</span>
          {error}
        </div>
      )}

      {preview && !error && (
        <div className="tce-import-preview">
          <div className="tce-import-preview__count">
            ✓ {preview.length} line{preview.length !== 1 ? "s" : ""} parsed
          </div>
          <div className="tce-import-preview__list">
            {preview.slice(0, 5).map((l) => (
              <div key={l.id} className="tce-import-preview__row">
                <span className="tce-import-preview__ts">{l.timestamp}</span>
                <span className="tce-import-preview__text">{l.text || <em>empty</em>}</span>
              </div>
            ))}
            {preview.length > 5 && (
              <div className="tce-import-preview__more">
                … and {preview.length - 5} more lines
              </div>
            )}
          </div>
          <button
            className="btn-primary tce-import-btn"
            onClick={handleImport}
            id="tce-import-confirm"
          >
            Load into editor
          </button>
        </div>
      )}
    </div>
  );
}
