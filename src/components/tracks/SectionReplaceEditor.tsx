"use client";

import { useMemo, useState } from "react";
import { parseLyrics } from "@/lib/parse-lyrics";

type Props = { track: { id: string; duration: number | null; lyrics: string | null; lyricsTimestamps?: string | null }; onSubmitted: () => void };
type Section = { label: string; start: number; end: number };

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

export default function SectionReplaceEditor({ track, onSubmitted }: Props) {
  const duration = Math.max(1, Math.round(track.duration ?? 180));
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(Math.min(15, duration));
  const [lyrics, setLyrics] = useState("");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const step = snapToGrid ? 1 : 0.1;
  const sections = useMemo<Section[]>(() => {
    const headers = (track.lyrics ?? "").split("\n").reduce<{ label: string; line: number }[]>((found, line, index) => {
      const match = line.trim().match(/^\[([^\]]+)\]$/);
      if (match) found.push({ label: match[1], line: index });
      return found;
    }, []);
    const timedLines = parseLyrics(track.lyrics, track.lyricsTimestamps).filter((line) => line.startTime >= 0);
    if (!headers.length) return [{ label: "Full track", start: 0, end: duration }];
    return headers.map((header, index) => {
      const proportionalStart = duration * (header.line / Math.max(1, (track.lyrics ?? "").split("\n").length));
      const proportionalEnd = index + 1 < headers.length ? duration * (headers[index + 1].line / Math.max(1, (track.lyrics ?? "").split("\n").length)) : duration;
      const timedStart = timedLines.find((line) => line.text && (track.lyrics ?? "").split("\n").slice(header.line + 1).includes(line.text))?.startTime;
      return { label: header.label, start: Math.round(timedStart ?? proportionalStart), end: Math.max(Math.round(timedStart ?? proportionalStart) + 1, Math.round(proportionalEnd)) };
    });
  }, [duration, track.lyrics, track.lyricsTimestamps]);
  const selectSection = (section: Section) => { setStart(section.start); setEnd(section.end); };
  const updateStart = (value: number) => setStart(Math.min(value, end - step));
  const updateEnd = (value: number) => setEnd(Math.max(value, start + step));
  const submit = async () => {
    setSubmitting(true); setMessage(null);
    try {
      const res = await fetch(`/api/tracks/${track.id}/replace-section`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startSeconds: start, endSeconds: end, infillLyrics: lyrics }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not start the section replacement");
      setMessage("Replacement started. The new version appears in your track list shortly.");
      onSubmitted();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not start the section replacement"); }
    finally { setSubmitting(false); }
  };
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="rounded px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 hover:text-white/90 transition-colors">Edit section</button>;
  return <div className="mt-2 rounded-xl border border-primary-500/30 bg-primary-500/5 p-3 space-y-3">
    <div className="flex items-center justify-between"><div><p className="text-sm font-medium text-white/85">Section editor</p><p className="text-[11px] text-white/40">Select a song part or fine-tune the timeline.</p></div><button type="button" onClick={() => setOpen(false)} className="text-xs text-white/40 hover:text-white/70">Close</button></div>
    <div className="relative h-16 overflow-hidden rounded-lg border border-white/10 bg-[#101118]">
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0, transparent calc(5% - 1px), rgba(255,255,255,.22) calc(5% - 1px), rgba(255,255,255,.22) 5%)" }} />
      {sections.map((section) => <button key={`${section.label}-${section.start}`} type="button" onClick={() => selectSection(section)} title={`${section.label}: ${formatTime(section.start)}–${formatTime(section.end)}`} className="absolute top-2 bottom-2 overflow-hidden rounded border border-primary-300/30 bg-primary-500/30 px-1 text-left text-[9px] font-medium uppercase tracking-wide text-primary-100 hover:bg-primary-500/50" style={{ left: `${section.start / duration * 100}%`, width: `${Math.max(2, (section.end - section.start) / duration * 100)}%` }}>{section.label}</button>)}
      <div className="absolute top-0 bottom-0 border-x-2 border-primary-300 bg-primary-400/15" style={{ left: `${start / duration * 100}%`, width: `${(end - start) / duration * 100}%` }} />
    </div>
    <div className="flex items-center justify-between text-[11px] text-white/50"><span>{formatTime(start)}</span><span className="text-primary-200">Selected: {formatTime(end - start)}</span><span>{formatTime(end)}</span></div>
    <div className="space-y-1"><input aria-label="Replacement start" type="range" min="0" max={duration - step} step={step} value={start} onChange={(event) => updateStart(Number(event.target.value))} className="w-full accent-primary-400"/><input aria-label="Replacement end" type="range" min={step} max={duration} step={step} value={end} onChange={(event) => updateEnd(Number(event.target.value))} className="w-full accent-primary-300"/></div>
    <label className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" checked={snapToGrid} onChange={(event) => setSnapToGrid(event.target.checked)} className="accent-primary-400" /> Snap to grid (1 second)</label>
    <textarea value={lyrics} onChange={(event) => setLyrics(event.target.value)} rows={3} placeholder="New lyrics for this section (optional)" className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80 placeholder:text-white/25 outline-none focus:border-primary-400/60" />
    {message && <p className={`text-xs ${message.startsWith("Replacement") ? "text-emerald-300" : "text-red-300"}`}>{message}</p>}
    <button type="button" onClick={submit} disabled={submitting} className="w-full rounded-lg bg-primary-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-400 disabled:opacity-50">{submitting ? "Starting replacement…" : `Replace ${formatTime(start)} – ${formatTime(end)}`}</button>
  </div>;
}
