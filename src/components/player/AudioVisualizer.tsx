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
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) { resolve([]); return; }
        ctx.drawImage(img, 0, 0, size, size);
        const pts = [
          [size * 0.2, size * 0.2],
          [size * 0.8, size * 0.2],
          [size * 0.5, size * 0.5],
          [size * 0.2, size * 0.8],
          [size * 0.8, size * 0.8],
        ];
        const colors = pts.map(([x, y]) => {
          const d = ctx.getImageData(Math.floor(x!), Math.floor(y!), 1, 1).data;
          return `rgb(${Math.min(255, d[0]! + 30)},${Math.min(255, d[1]! + 20)},${Math.min(255, d[2]! + 30)})`;
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
  // Track which element the analyzer was created with so we don't re-init unnecessarily
  const connectedElementRef = useRef<HTMLAudioElement | null>(null);

  async function registerCoverGradient(analyzer: any, url: string) {
    if (coverGradientRegistered.current === url) return;
    const colors = await extractCoverColors(url);
    if (!analyzer || colors.length < 2) return;
    try {
      analyzer.registerGradient("cover", {
        bgColor: "#000011",
        colorStops: colors.map((color: string, i: number) => ({
          color,
          pos: i / (colors.length - 1),
        })),
      });
      coverGradientRegistered.current = url;
      if (analyzer.gradient === "cover") analyzer.gradient = "cover";
    } catch (e) {
      console.warn("[AudioVisualizer] cover gradient error:", e);
    }
  }

  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 5;

  // Create analyzer once per audio element — never destroy while mounted
  useEffect(() => {
    if (!audioElement || !containerRef.current) return;
    if (connectedElementRef.current === audioElement) return; // already connected

    connectedElementRef.current = audioElement;
    retryCountRef.current = 0;
    let cancelled = false;

    async function init() {
      try {
        const { default: AudioMotionAnalyzer } = await import("audiomotion-analyzer");
        if (cancelled || !containerRef.current) return;

        // If a previous analyzer exists from a different element, destroy it first
        if (analyzerRef.current) {
          try { analyzerRef.current.destroy(); } catch {}
          analyzerRef.current = null;
        }

        const analyzer = new AudioMotionAnalyzer(containerRef.current, {
          source: audioElement!,
          mode,
          gradient: gradient === "cover" && !coverUrl ? "prism" : gradient,
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
        retryCountRef.current = 0; // success — reset counter

        if (coverUrl) {
          void registerCoverGradient(analyzer, coverUrl);
        }
      } catch (e) {
        console.warn("[AudioVisualizer] init error:", e);
        connectedElementRef.current = null;

        if (!cancelled && retryCountRef.current < MAX_RETRIES) {
          const delay = Math.min(1000 * 2 ** retryCountRef.current, 16000);
          retryCountRef.current++;
          console.log(`[AudioVisualizer] retrying in ${delay}ms (attempt ${retryCountRef.current}/${MAX_RETRIES})`);
          retryTimerRef.current = setTimeout(() => { if (!cancelled) void init(); }, delay);
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [audioElement]);

  // Destroy only on final unmount
  useEffect(() => {
    return () => {
      if (analyzerRef.current) {
        try { analyzerRef.current.destroy(); } catch {}
        analyzerRef.current = null;
      }
      connectedElementRef.current = null;
      coverGradientRegistered.current = null;
    };
  }, []);

  useEffect(() => {
    if (!analyzerRef.current) return;
    analyzerRef.current.mode = mode;
  }, [mode]);

  useEffect(() => {
    if (!analyzerRef.current) return;
    if (gradient === "cover") {
      if (!coverUrl) {
        analyzerRef.current.gradient = "prism";
      } else if (coverGradientRegistered.current !== coverUrl) {
        void registerCoverGradient(analyzerRef.current, coverUrl).then(() => {
          if (analyzerRef.current) analyzerRef.current.gradient = "cover";
        });
      } else {
        analyzerRef.current.gradient = "cover";
      }
    } else {
      analyzerRef.current.gradient = gradient;
    }
  }, [gradient, coverUrl]);

  useEffect(() => {
    if (!analyzerRef.current || !coverUrl) return;
    void registerCoverGradient(analyzerRef.current, coverUrl);
  }, [coverUrl]);

  // Always render the container — toggle visibility via CSS to avoid recreating MediaElementSource
  return (
    <div
      ref={containerRef}
      className="absolute bottom-0 left-0 right-0 h-36 pointer-events-none transition-opacity duration-500"
      style={{ opacity: enabled ? 0.55 : 0 }}
    />
  );
}
