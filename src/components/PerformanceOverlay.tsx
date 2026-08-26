"use client";

import { useEffect, useState, useCallback } from "react";
import { formatBytes } from "@/lib/perfMonitor";

interface PerfSnapshot {
  sessionStartedAt: number;
  uptimeMs: number;
  visibleMs: number;
  hiddenMs: number;
  longTaskCount: number;
  longTaskTotalMs: number;
  longTaskMaxMs: number;
  networkBytes: number;
  networkBytesByCategory: Record<string, number>;
  networkBytesFormatted: string;
  networkUncounted: number;
  storageUsageBytes: number | null;
  storageQuotaBytes: number | null;
  storageUsageFormatted: string | null;
}

interface PerformanceOverlayProps {
  onClose: () => void;
}

export default function PerformanceOverlay({ onClose }: PerformanceOverlayProps) {
  const [perfSnapshot, setPerfSnapshot] = useState<PerfSnapshot | null>(null);
  const [perfLogging, setPerfLogging] = useState(false);

  const updateSnapshot = useCallback(() => {
    if (typeof window !== "undefined" && (window as any).__melodiqPerf) {
      setPerfSnapshot((window as any).__melodiqPerf.snapshot());
    }
  }, []);

  useEffect(() => {
    updateSnapshot();
    const interval = setInterval(updateSnapshot, 2000);
    
    return () => {
      clearInterval(interval);
    };
  }, [updateSnapshot]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close on Escape
      if (e.key === "Escape") {
        onClose();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const toggleLogging = () => {
    const newState = !perfLogging;
    setPerfLogging(newState);
    if (typeof window !== "undefined" && (window as any).__melodiqPerf) {
      (window as any).__melodiqPerf.setLogging(newState);
    }
  };

  if (!perfSnapshot) {
    return (
      <div className="fixed inset-0 z-9999 bg-black/80 backdrop-blur-sm flex items-center justify-center">
        <div className="text-white text-lg">Loading performance data...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-9999 bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Performance Monitor</h1>
          <div className="flex gap-2">
            <button
              onClick={toggleLogging}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                perfLogging
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-white/10 text-white/60 hover:bg-white/15"
              }`}
            >
              {perfLogging ? "Logging ✓" : "Logging ✗"}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
            >
              Sluiten (Esc)
            </button>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* Uptime */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Sessie uptime</p>
            <p className="mt-1 text-3xl font-bold text-white">
              {(perfSnapshot.uptimeMs / 1000 / 60).toFixed(1)} min
            </p>
            <p className="text-xs text-white/40 mt-1">
              Gestart: {new Date(perfSnapshot.sessionStartedAt).toLocaleTimeString()}
            </p>
          </div>

          {/* Network Total */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Netwerk verbruik</p>
            <p className="mt-1 text-3xl font-bold text-white">
              {perfSnapshot.networkBytesFormatted}
            </p>
            {perfSnapshot.networkUncounted > 0 && (
              <p className="text-xs text-white/40 mt-1">
                +{perfSnapshot.networkUncounted} onbekende cross-origin requests
              </p>
            )}
          </div>

          {/* Storage */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Browser opslag</p>
            <p className="mt-1 text-3xl font-bold text-white">
              {perfSnapshot.storageUsageFormatted || "Onbekend"}
            </p>
            {perfSnapshot.storageQuotaBytes && (
              <p className="text-xs text-white/40 mt-1">
                van {formatBytes(perfSnapshot.storageQuotaBytes)}
              </p>
            )}
          </div>

          {/* Long Tasks */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Main-thread belasting</p>
            <p className="mt-1 text-3xl font-bold text-white">
              {perfSnapshot.longTaskCount}
            </p>
            <p className="text-xs text-white/40 mt-1">
              Totaal: {Math.round(perfSnapshot.longTaskTotalMs)}ms | 
              Max: {Math.round(perfSnapshot.longTaskMaxMs)}ms
            </p>
          </div>

          {/* Visibility */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 md:col-span-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Zichtbaarheid</p>
            <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500/40 to-blue-500/40"
                style={{
                  width: `${Math.min(100, (perfSnapshot.visibleMs / perfSnapshot.uptimeMs) * 100)}%`
                }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-white/60 mt-1">
              <span>Zichtbaar: {(perfSnapshot.visibleMs / 1000 / 60).toFixed(1)} min</span>
              <span>Verborgen: {(perfSnapshot.hiddenMs / 1000 / 60).toFixed(1)} min</span>
            </div>
          </div>
        </div>

        {/* Network Breakdown */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">Netwerk verbruik per categorie</h3>
          <div className="space-y-2">
            {Object.entries(perfSnapshot.networkBytesByCategory).map(([category, bytes]) => (
              <div key={category} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{
                    backgroundColor: category === "audio" ? "#3b82f6" :
                                    category === "image" ? "#8b5cf6" :
                                    category === "api" ? "#10b981" :
                                    "#6b7280"
                  }}></span>
                  <span className="capitalize text-white/80">{category}</span>
                </div>
                <span className="text-white font-medium">{formatBytes(bytes)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Network Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-medium text-white/60 mb-2">Audio bestanden</p>
            <p className="text-2xl font-bold text-white">{formatBytes(perfSnapshot.networkBytesByCategory.audio)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-medium text-white/60 mb-2">Afbeeldingen</p>
            <p className="text-2xl font-bold text-white">{formatBytes(perfSnapshot.networkBytesByCategory.image)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-medium text-white/60 mb-2">API calls</p>
            <p className="text-2xl font-bold text-white">{formatBytes(perfSnapshot.networkBytesByCategory.api)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-medium text-white/60 mb-2">Overig</p>
            <p className="text-2xl font-bold text-white">{formatBytes(perfSnapshot.networkBytesByCategory.other)}</p>
          </div>
        </div>

        {/* Tips */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-lg font-semibold text-white mb-2">Tips</h3>
          <ul className="text-sm text-white/70 space-y-1">
            <li>• Gebruik <kbd className="px-2 py-1 bg-white/10 rounded text-xs">Ctrl+P</kbd> om deze overlay te toggelen</li>
            <li>• Klik op <kbd className="px-2 py-1 bg-white/10 rounded text-xs">Logging ✓/✗</kbd> om console logs te activeren</li>
            <li>• Druk op <kbd className="px-2 py-1 bg-white/10 rounded text-xs">Esc</kbd> om te sluiten</li>
            <li>• Netwerkverbruik is cumulatief sinds het laden van de pagina</li>
            <li>• Main-thread belasting toont taken langer dan 50ms</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
