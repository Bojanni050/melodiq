"use client";

import React, { useState } from "react";
import type { LyricLine } from "@/lib/timecoded-editor/LyricsParser";
import { serializeLyrics } from "@/lib/timecoded-editor/LyricsSerializer";

interface ExportPanelProps {
  lines: LyricLine[];
  trackId?: string;
  isSaving?: boolean;
  onSaveToTrack?: () => void;
}

export default function ExportPanel({
  lines,
  trackId,
  isSaving,
  onSaveToTrack,
}: ExportPanelProps) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const serialized = serializeLyrics(lines);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(serialized);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement("textarea");
      el.value = serialized;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleDownload() {
    const blob = new Blob([serialized], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lyrics.lrc";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (lines.length === 0) return null;

  return (
    <div className="tce-export">
      <div className="tce-export__row">
        {trackId && onSaveToTrack && (
          <button
            className="btn-primary tce-export-save-btn"
            onClick={onSaveToTrack}
            disabled={isSaving}
            id="tce-save-track"
            aria-label="Save timecoded lyrics back to track"
          >
            {isSaving ? (
              <><span className="tce-spinner" aria-hidden="true" /> Saving…</>
            ) : (
              <>💾 Save to Track</>
            )}
          </button>
        )}
        <button
          className="btn-secondary tce-export-btn"
          onClick={handleCopy}
          id="tce-copy-lrc"
          aria-label="Copy LRC to clipboard"
        >
          {copied ? "✓ Copied!" : "Copy LRC"}
        </button>
        <button
          className="btn-ghost tce-export-btn"
          onClick={handleDownload}
          id="tce-download-lrc"
          aria-label="Download as .lrc file"
        >
          ⬇ Download
        </button>
        <button
          className="btn-ghost tce-export-btn"
          onClick={() => setShowPreview((v) => !v)}
          id="tce-preview-toggle"
          aria-expanded={showPreview}
        >
          {showPreview ? "Hide preview" : "Preview LRC"}
        </button>
      </div>

      {showPreview && (
        <pre className="tce-export-preview" aria-label="LRC preview">
          {serialized}
        </pre>
      )}
    </div>
  );
}
