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
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const connectedElementRef = useRef<HTMLAudioElement | null>(null);
  const coverGradientRegistered = useRef<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 5;

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
    } catch (e) {
      console.warn("[AudioVisualizer] cover gradient error:", e);
    }
  }

  // One-time setup per audio element: create AudioContext + MediaElementSource ourselves.
  // Retries and re-creations of AudioMotionAnalyzer reuse the same source node,
  // so "already connected to a different AudioContext" never happens.
  useEffect(() => {
    if (!audioElement || !containerRef.current) return;
    if (connectedElementRef.current === audioElement) return;

    connectedElementRef.current = audioElement;
    retryCountRef.current = 0;
    let cancelled = false;

    async function init() {
      try {
        const { default: AudioMotionAnalyzer } = await import("audiomotion-analyzer");
        if (cancelled || !containerRef.current) return;

        // Create AudioContext once per audio element
        if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
          audioCtxRef.current = new AudioContext();
        }
        // Resume if suspended — browsers suspend new AudioContexts until user interaction
        if (audioCtxRef.current.state === "suspended") {
          await audioCtxRef.current.resume();
        }

        // Create MediaElementSource once — reused on every retry/recreate
        if (!sourceNodeRef.current) {
          sourceNodeRef.current = audioCtxRef.current.createMediaElementSource(audioElement!);
        }

        if (analyzerRef.current) {
          try { analyzerRef.current.destroy(); } catch {}
          analyzerRef.current = null;
        }

        // Never pass "cover" to the constructor — it isn't registered yet
        const safeGradient = gradient === "cover" ? "prism" : gradient;

        const analyzer = new AudioMotionAnalyzer(containerRef.current, {
          audioCtx: audioCtxRef.current,
          source: sourceNodeRef.current,
          // connectSpeakers: true (default) — audioMotion owns source → analyzer → destination
          mode,
          gradient: safeGradient,
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
        retryCountRef.current = 0;

        // Auto-resume if browser suspends the AudioContext (tab switch, etc.)
        const ctx = audioCtxRef.current!;
        const handleStateChange = () => {
          if (ctx.state === "suspended") void ctx.resume();
        };
        ctx.addEventListener("statechange", handleStateChange);

        if (coverUrl) {
          await registerCoverGradient(analyzer, coverUrl);
        }
        if (gradient === "cover" && coverGradientRegistered.current) {
          analyzer.gradient = "cover";
        }
      } catch (e: any) {
        console.warn("[AudioVisualizer] init error:", e);

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

  // On unmount: destroy analyzer then reconnect source → destination so audio keeps playing
  useEffect(() => {
    return () => {
      if (analyzerRef.current) {
        try { analyzerRef.current.destroy(); } catch {}
        analyzerRef.current = null;
      }
      // Restore direct audio path after analyzer is gone
      if (sourceNodeRef.current && audioCtxRef.current) {
        try { sourceNodeRef.current.connect(audioCtxRef.current.destination); } catch {}
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

  return (
    <div
      ref={containerRef}
      className="absolute bottom-0 left-0 right-0 h-36 pointer-events-none transition-opacity duration-500 z-20"
      style={{ opacity: enabled ? 0.55 : 0 }}
    />
  );
}
