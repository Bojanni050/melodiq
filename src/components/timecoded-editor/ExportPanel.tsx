"use client";

import React, { useState } from "react";
import type { LyricLine } from "@/lib/timecoded-editor/LyricsParser";
import { serializeLyrics } from "@/lib/timecoded-editor/LyricsSerializer";
import type { TclDocument } from "@/lib/tcl/types";
import { exportSrt, exportEnhancedLrc, exportTtml, exportJson } from "@/lib/tcl/exporters";

interface ExportPanelProps {
  lines: LyricLine[];
  trackId?: string;
  isSaving?: boolean;
  onSaveToTrack?: () => void;
  /** When present, enables SRT/Enhanced-LRC/TTML/JSON exports (word-level data). */
  tclDocument?: TclDocument;
  wordTimingClearedIds?: Set<number>;
}

type ExtraFormat = "srt" | "enhanced-lrc" | "ttml" | "json";

function downloadText(content: string, filename: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportPanel({
  lines,
  trackId,
  isSaving,
  onSaveToTrack,
  tclDocument,
  wordTimingClearedIds,
}: ExportPanelProps) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<ExtraFormat | "lrc">("lrc");

  const serialized = serializeLyrics(lines);

  function exportContent(format: ExtraFormat): string {
    if (!tclDocument) return "";
    switch (format) {
      case "srt": return exportSrt(tclDocument);
      case "enhanced-lrc": return exportEnhancedLrc(tclDocument);
      case "ttml": return exportTtml(tclDocument);
      case "json": return exportJson(tclDocument);
    }
  }

  function handleExtraDownload(format: ExtraFormat) {
    const content = exportContent(format);
    if (!content) return;
    const files: Record<ExtraFormat, { name: string; mime: string }> = {
      srt: { name: "lyrics.srt", mime: "text/plain;charset=utf-8" },
      "enhanced-lrc": { name: "lyrics.enhanced.lrc", mime: "text/plain;charset=utf-8" },
      ttml: { name: "lyrics.ttml", mime: "application/ttml+xml;charset=utf-8" },
      json: { name: "lyrics.tcl.json", mime: "application/json;charset=utf-8" },
    };
    downloadText(content, files[format].name, files[format].mime);
  }

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
          onClick={() => {
            if (showPreview && previewFormat === "lrc") setShowPreview(false);
            else { setPreviewFormat("lrc"); setShowPreview(true); }
          }}
          id="tce-preview-toggle"
          aria-expanded={showPreview && previewFormat === "lrc"}
        >
          {showPreview && previewFormat === "lrc" ? "Hide preview" : "Preview LRC"}
        </button>

        {tclDocument && (
          <>
            <button className="btn-ghost tce-export-btn" onClick={() => handleExtraDownload("srt")} id="tce-download-srt">
              ⬇ SRT
            </button>
            <button className="btn-ghost tce-export-btn" onClick={() => handleExtraDownload("enhanced-lrc")} id="tce-download-enhanced-lrc">
              ⬇ Enhanced LRC
            </button>
            <button className="btn-ghost tce-export-btn" onClick={() => handleExtraDownload("ttml")} id="tce-download-ttml">
              ⬇ TTML
            </button>
            <button className="btn-ghost tce-export-btn" onClick={() => handleExtraDownload("json")} id="tce-download-json">
              ⬇ JSON
            </button>
          </>
        )}
      </div>

      {tclDocument && wordTimingClearedIds && wordTimingClearedIds.size > 0 && (
        <p className="tce-generate-cta__error" role="status">
          ⚠ {wordTimingClearedIds.size} line{wordTimingClearedIds.size !== 1 ? "s" : ""} lost word-level
          timing after editing — those lines export with line-level timing only.
        </p>
      )}

      {showPreview && (
        <pre className="tce-export-preview" aria-label={`${previewFormat} preview`}>
          {previewFormat === "lrc" ? serialized : exportContent(previewFormat)}
        </pre>
      )}
    </div>
  );
}
