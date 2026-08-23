"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type WaveSurferType from "wavesurfer.js";
import type { Region as WaveSurferRegion } from "wavesurfer.js/dist/plugins/regions.js";
import { parseLyrics } from "@/lib/parse-lyrics";

type Props = {
  track: { id: string; duration: number | null; lyrics: string | null; lyricsTimestamps?: string | null };
  onSubmitted: () => void;
};
type Section = { label: string; start: number; end: number };

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

function sectionColor(label: string): string {
  const key = label.toLowerCase();
  if (key.includes("chorus") || key.includes("hook")) return "rgba(249,115,22,0.35)"; // orange
  if (key.includes("bridge")) return "rgba(234,179,8,0.35)"; // yellow
  if (key.includes("pre-chorus") || key.includes("prechorus")) return "rgba(139,92,246,0.35)"; // violet
  if (key.includes("intro") || key.includes("outro")) return "rgba(6,182,212,0.3)"; // teal
  if (key.includes("verse")) return "rgba(236,72,153,0.35)"; // pink (brand primary)
  return "rgba(255,255,255,0.12)";
}

export default function SectionReplaceEditor({ track, onSubmitted }: Props) {
  const duration = Math.max(1, Math.round(track.duration ?? 180));
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(Math.min(15, duration));
  const [lyrics, setLyrics] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [wsReady, setWsReady] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [wsDuration, setWsDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurferType | null>(null);
  const selectionRegionRef = useRef<WaveSurferRegion | null>(null);

  const sections = useMemo<Section[]>(() => {
    const headers = (track.lyrics ?? "").split("\n").reduce<{ label: string; line: number }[]>((found, line, index) => {
      const match = line.trim().match(/^\[([^\]]+)\]$/);
      if (match) found.push({ label: match[1], line: index });
      return found;
    }, []);
    const timedLines = parseLyrics(track.lyrics, track.lyricsTimestamps).filter((line) => line.startTime >= 0);
    if (!headers.length) return [{ label: "Full track", start: 0, end: duration }];
    return headers.map((header, index) => {
      const lineCount = Math.max(1, (track.lyrics ?? "").split("\n").length);
      const proportionalStart = duration * (header.line / lineCount);
      const proportionalEnd = index + 1 < headers.length ? duration * (headers[index + 1].line / lineCount) : duration;
      const timedStart = timedLines.find((line) => line.text && (track.lyrics ?? "").split("\n").slice(header.line + 1).includes(line.text))?.startTime;
      const sectionStart = Math.round(timedStart ?? proportionalStart);
      const sectionEnd = Math.max(sectionStart + 1, Math.round(proportionalEnd));
      return { label: header.label, start: sectionStart, end: sectionEnd };
    });
  }, [duration, track.lyrics, track.lyricsTimestamps]);

  const effectiveDuration = wsDuration || duration;

  // Load the waveform once the panel is opened — lazy, so collapsed track
  // rows never pay for an audio fetch + decode.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let instance: WaveSurferType | null = null;

    (async () => {
      const [{ default: WaveSurfer }, { default: RegionsPlugin }] = await Promise.all([
        import("wavesurfer.js"),
        import("wavesurfer.js/dist/plugins/regions.js"),
      ]);
      if (cancelled || !containerRef.current) return;

      instance = WaveSurfer.create({
        container: containerRef.current,
        waveColor: "#5f5f78",
        progressColor: "#8b74ff",
        cursorColor: "#ffffff",
        height: 72,
        url: `/api/tracks/${track.id}/download`,
        normalize: true,
      });

      const regions = instance.registerPlugin(RegionsPlugin.create());

      instance.on("ready", () => {
        if (cancelled || !instance) return;
        const dur = instance.getDuration();
        setWsDuration(dur);
        setWsReady(true);

        const initialEnd = Math.min(end, dur) || Math.min(15, dur);
        const region = regions.addRegion({
          start: Math.min(start, dur),
          end: Math.max(initialEnd, Math.min(start, dur) + 0.5),
          color: "rgba(255,255,255,0.22)",
          drag: true,
          resize: true,
        });
        selectionRegionRef.current = region;
      });
      instance.on("error", () => {
        if (!cancelled) setWsError("Couldn't load the audio waveform.");
      });
      instance.on("audioprocess", () => !cancelled && instance && setCurrentTime(instance.getCurrentTime()));
      instance.on("seeking", () => !cancelled && instance && setCurrentTime(instance.getCurrentTime()));
      instance.on("play", () => !cancelled && setIsPlaying(true));
      instance.on("pause", () => !cancelled && setIsPlaying(false));
      instance.on("finish", () => !cancelled && setIsPlaying(false));

      regions.on("region-update", (region) => {
        if (region.id !== selectionRegionRef.current?.id) return;
        setStart(region.start);
        setEnd(region.end);
      });
      regions.on("region-updated", (region) => {
        if (region.id !== selectionRegionRef.current?.id) return;
        setStart(region.start);
        setEnd(region.end);
      });

      wsRef.current = instance;
    })();

    return () => {
      cancelled = true;
      instance?.destroy();
      wsRef.current = null;
      selectionRegionRef.current = null;
      setWsReady(false);
      setWsDuration(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, track.id]);

  function selectSection(section: Section) {
    const clampedStart = Math.min(section.start, effectiveDuration);
    const clampedEnd = Math.min(Math.max(section.end, clampedStart + 0.5), effectiveDuration);
    setStart(clampedStart);
    setEnd(clampedEnd);
    selectionRegionRef.current?.setOptions({ start: clampedStart, end: clampedEnd });
  }

  function togglePlay() {
    wsRef.current?.playPause();
  }

  const submit = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/tracks/${track.id}/replace-section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startSeconds: start, endSeconds: end, infillLyrics: lyrics }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not start the section replacement");
      setMessage("Replacement started. The new version appears in your track list shortly.");
      onSubmitted();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start the section replacement");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 hover:text-white/90 transition-colors"
      >
        Edit section
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-primary-500/30 bg-primary-500/5 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white/85">Section editor</p>
          <p className="text-[11px] text-white/40">Click a section to select it, or drag on the waveform to fine-tune.</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-white/40 hover:text-white/70">
          Close
        </button>
      </div>

      {/* Section label chips */}
      <div className="flex flex-wrap gap-1.5">
        {sections.map((section) => (
          <button
            key={`${section.label}-${section.start}`}
            type="button"
            onClick={() => selectSection(section)}
            title={`${section.label}: ${formatTime(section.start)}–${formatTime(section.end)}`}
            className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/85 transition-opacity hover:opacity-80"
            style={{ backgroundColor: sectionColor(section.label) }}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* Waveform with colored section backdrop + a single draggable/resizable selection region */}
      <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#101118]">
        <div className="pointer-events-none absolute inset-0 z-0">
          {sections.map((section) => (
            <div
              key={`${section.label}-${section.start}`}
              className="absolute inset-y-0"
              style={{
                left: `${(section.start / effectiveDuration) * 100}%`,
                width: `${Math.max(0.5, ((section.end - section.start) / effectiveDuration) * 100)}%`,
                backgroundColor: sectionColor(section.label),
              }}
            />
          ))}
        </div>
        <div ref={containerRef} className="relative z-10" />
        {!wsReady && !wsError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center text-[11px] text-white/40">
            Loading waveform…
          </div>
        )}
        {wsError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center text-[11px] text-red-300">
            {wsError}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-white/50">
        <button type="button" onClick={togglePlay} disabled={!wsReady} className="text-white/70 hover:text-white disabled:opacity-40">
          {isPlaying ? "⏸ Pause" : "▶ Play"}
        </button>
        <span>{formatTime(currentTime)} / {formatTime(effectiveDuration)}</span>
        <span className="text-primary-200">Selected: {formatTime(start)} – {formatTime(end)} ({formatTime(end - start)})</span>
      </div>

      <textarea
        value={lyrics}
        onChange={(event) => setLyrics(event.target.value)}
        rows={3}
        placeholder="New lyrics for this section (optional)"
        className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80 placeholder:text-white/25 outline-none focus:border-primary-400/60"
      />
      {message && (
        <p className={`text-xs ${message.startsWith("Replacement") ? "text-emerald-300" : "text-red-300"}`}>{message}</p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="w-full rounded-lg bg-primary-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-400 disabled:opacity-50"
      >
        {submitting ? "Starting replacement…" : `Replace ${formatTime(start)} – ${formatTime(end)}`}
      </button>
    </div>
  );
}
