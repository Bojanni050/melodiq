"use client";

import { useEffect, useRef, useState } from "react";
import type WaveSurferType from "wavesurfer.js";
import type { TclDocument } from "@/lib/tcl/types";

interface WaveformPanelProps {
  audioUrl: string;
  doc: TclDocument;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export default function WaveformPanel({ audioUrl, doc }: WaveformPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurferType | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(60);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let instance: WaveSurferType | null = null;

    (async () => {
      const { default: WaveSurfer } = await import("wavesurfer.js");
      if (cancelled || !containerRef.current) return;

      instance = WaveSurfer.create({
        container: containerRef.current,
        waveColor: "#5f5f78",
        progressColor: "#8b5cf6",
        cursorColor: "#ffffff",
        height: 80,
        url: audioUrl,
        minPxPerSec: zoom,
        normalize: true,
      });

      instance.on("ready", () => {
        if (cancelled || !instance) return;
        setDuration(instance.getDuration());
        setReady(true);
      });
      instance.on("audioprocess", () => {
        if (!cancelled && instance) setCurrentTime(instance.getCurrentTime());
      });
      instance.on("seeking", () => {
        if (!cancelled && instance) setCurrentTime(instance.getCurrentTime());
      });
      instance.on("play", () => !cancelled && setIsPlaying(true));
      instance.on("pause", () => !cancelled && setIsPlaying(false));
      instance.on("finish", () => !cancelled && setIsPlaying(false));

      wsRef.current = instance;
    })();

    return () => {
      cancelled = true;
      instance?.destroy();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  useEffect(() => {
    if (ready) wsRef.current?.zoom(zoom);
  }, [zoom, ready]);

  useEffect(() => {
    wsRef.current?.setPlaybackRate(speed);
  }, [speed]);

  function togglePlay() {
    wsRef.current?.playPause();
  }

  function seekTo(seconds: number) {
    const ws = wsRef.current;
    if (!ws || !duration) return;
    ws.seekTo(Math.max(0, Math.min(1, seconds / duration)));
    if (!isPlaying) ws.play();
  }

  const activeLineIndex = doc.lines.findIndex((l) => currentTime >= l.start && currentTime < l.end);
  const activeWordKey = (() => {
    if (activeLineIndex < 0) return null;
    const line = doc.lines[activeLineIndex];
    const wordIndex = line.words.findIndex((w) => currentTime >= w.start && currentTime < w.end);
    return wordIndex >= 0 ? `${activeLineIndex}:${wordIndex}` : null;
  })();

  return (
    <div className="tce-waveform">
      <div className="tce-waveform__controls">
        <button
          type="button"
          className="tce-icon-btn"
          onClick={togglePlay}
          disabled={!ready}
          aria-label={isPlaying ? "Pause" : "Play"}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <span className="tce-waveform__time">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <label className="tce-waveform__speed">
          Speed
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Playback speed">
            {SPEEDS.map((s) => (
              <option key={s} value={s}>{s}x</option>
            ))}
          </select>
        </label>
        <label className="tce-waveform__zoom">
          Zoom
          <input
            type="range"
            min={20}
            max={300}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Waveform zoom"
          />
        </label>
      </div>

      <div ref={containerRef} className="tce-waveform__track" />

      <div className="tce-waveform__lyrics">
        {doc.lines.map((line, li) => (
          <p
            key={li}
            className={`tce-waveform__line${li === activeLineIndex ? " tce-waveform__line--active" : ""}`}
            onClick={() => seekTo(line.start)}
          >
            {line.words.length > 0
              ? line.words.map((w, wi) => (
                  <span
                    key={wi}
                    className={`tce-waveform__word${activeWordKey === `${li}:${wi}` ? " tce-waveform__word--active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      seekTo(w.start);
                    }}
                  >
                    {w.word}{" "}
                  </span>
                ))
              : line.text}
          </p>
        ))}
      </div>
    </div>
  );
}
