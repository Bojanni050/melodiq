"use client";

import { useEffect, useRef } from "react";

interface Props {
  audioElement: HTMLAudioElement | null;
  mode: number;
  gradient: string;
  enabled: boolean;
  coverUrl?: string | null;
}

async function extractCoverColors(src: string): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 64;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve([]); return; }
        ctx.drawImage(img, 0, 0, size, size);
        // Sample 5 points spread across the image
        const pts = [
          [size * 0.2, size * 0.2],
          [size * 0.8, size * 0.2],
          [size * 0.5, size * 0.5],
          [size * 0.2, size * 0.8],
          [size * 0.8, size * 0.8],
        ];
        const colors = pts.map(([x, y]) => {
          const d = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
          // Boost saturation slightly for visual impact
          const r = Math.min(255, d[0] + 30);
          const g = Math.min(255, d[1] + 20);
          const b = Math.min(255, d[2] + 30);
          return `rgb(${r},${g},${b})`;
        });
        resolve(colors);
      } catch {
        resolve([]);
      }
    };
    img.onerror = () => resolve([]);
    img.src = src;
  });
}

export default function AudioVisualizer({ audioElement, mode, gradient, enabled, coverUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const analyzerRef = useRef<any>(null);
  const coverGradientRegistered = useRef<string | null>(null);

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

        // Register cover gradient if we have a URL
        if (coverUrl) {
          void registerCoverGradient(analyzer, coverUrl);
        }
      } catch (e) {
        console.warn("[AudioVisualizer] init error:", e);
      }
    }

    void init();

    return () => {
      destroyed = true;
      coverGradientRegistered.current = null;
      if (analyzerRef.current) {
        try { analyzerRef.current.destroy(); } catch {}
        analyzerRef.current = null;
      }
    };
  }, [enabled, audioElement]);

  async function registerCoverGradient(analyzer: any, url: string) {
    if (coverGradientRegistered.current === url) return;
    const colors = await extractCoverColors(url);
    if (!analyzerRef.current || colors.length < 2) return;
    try {
      analyzer.registerGradient("cover", {
        bgColor: "#000011",
        colorStops: colors.map((color, i) => ({
          color,
          pos: i / (colors.length - 1),
        })),
      });
      coverGradientRegistered.current = url;
      // If currently using cover gradient, re-apply to pick up new colors
      if (analyzerRef.current.gradient === "cover") {
        analyzerRef.current.gradient = "cover";
      }
    } catch (e) {
      console.warn("[AudioVisualizer] cover gradient error:", e);
    }
  }

  useEffect(() => {
    if (!analyzerRef.current) return;
    analyzerRef.current.mode = mode;
  }, [mode]);

  useEffect(() => {
    if (!analyzerRef.current) return;
    if (gradient === "cover" && coverUrl && coverGradientRegistered.current !== coverUrl) {
      void registerCoverGradient(analyzerRef.current, coverUrl).then(() => {
        if (analyzerRef.current) analyzerRef.current.gradient = "cover";
      });
    } else {
      analyzerRef.current.gradient = gradient;
    }
  }, [gradient]);

  useEffect(() => {
    if (!analyzerRef.current || !coverUrl) return;
    void registerCoverGradient(analyzerRef.current, coverUrl);
  }, [coverUrl]);

  if (!enabled) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-0 left-0 right-0 h-36 pointer-events-none"
      style={{ opacity: 0.55 }}
    />
  );
}
