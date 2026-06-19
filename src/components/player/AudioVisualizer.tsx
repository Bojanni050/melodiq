"use client";

import { useEffect, useRef } from "react";

interface Props {
  audioElement: HTMLAudioElement | null;
  mode: number;
  gradient: string;
  enabled: boolean;
}

export default function AudioVisualizer({ audioElement, mode, gradient, enabled }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const analyzerRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled || !audioElement || !containerRef.current) return;

    let destroyed = false;

    async function init() {
      try {
        const { default: AudioMotionAnalyzer } = await import("audiomotion-analyzer");
        if (destroyed || !containerRef.current) return;

        const analyzer = new AudioMotionAnalyzer(containerRef.current, {
          source: audioElement!,
          mode,
          gradient,
          showBgColor: false,
          bgAlpha: 0,
          overlay: true,
          showPeaks: true,
          reflexRatio: 0.35,
          reflexAlpha: 0.15,
          reflexFit: true,
          smoothing: 0.75,
          minFreq: 20,
          maxFreq: 20000,
          channelLayout: "single",
        });

        analyzerRef.current = analyzer;
      } catch (e) {
        console.warn("[AudioVisualizer] init error:", e);
      }
    }

    void init();

    return () => {
      destroyed = true;
      if (analyzerRef.current) {
        try { analyzerRef.current.destroy(); } catch {}
        analyzerRef.current = null;
      }
    };
  }, [enabled, audioElement]);

  useEffect(() => {
    if (!analyzerRef.current) return;
    analyzerRef.current.mode = mode;
  }, [mode]);

  useEffect(() => {
    if (!analyzerRef.current) return;
    analyzerRef.current.gradient = gradient;
  }, [gradient]);

  if (!enabled) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-0 left-0 right-0 h-36 pointer-events-none"
      style={{ opacity: 0.55 }}
    />
  );
}
