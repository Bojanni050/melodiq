// Lightweight, dependency-free perf/battery-impact instrumentation.
//
// There is no analytics backend in this app, so this intentionally does not
// try to ship data anywhere — it just keeps a running snapshot in memory and
// exposes it on `window.__melodiqPerf` for manual inspection (e.g. over
// remote debugging on a real phone) plus an optional periodic console
// summary. This is meant to make "does X actually run when it shouldn't"
// questions answerable with real numbers instead of guesswork.
//
// Enable the console summary with `NEXT_PUBLIC_PERF_DEBUG=1` at build time,
// or at runtime via `window.__melodiqPerf.setLogging(true)`.

type ByteCategory = "audio" | "image" | "api" | "other";

interface PerfSnapshot {
  sessionStartedAt: number;
  uptimeMs: number;
  visibleMs: number;
  hiddenMs: number;
  longTaskCount: number;
  longTaskTotalMs: number;
  longTaskMaxMs: number;
  networkBytes: number;
  networkBytesByCategory: Record<ByteCategory, number>;
  networkBytesFormatted: string;
  networkUncounted: number;
  storageUsageBytes: number | null;
  storageQuotaBytes: number | null;
  storageUsageFormatted: string | null;
}

const state = {
  sessionStartedAt: Date.now(),
  visibleMs: 0,
  hiddenMs: 0,
  lastVisibilityChangeAt: Date.now(),
  longTaskCount: 0,
  longTaskTotalMs: 0,
  longTaskMaxMs: 0,
  loggingEnabled: process.env.NEXT_PUBLIC_PERF_DEBUG === "1",
  networkBytes: 0,
  networkBytesByCategory: { audio: 0, image: 0, api: 0, other: 0 } as Record<ByteCategory, number>,
  // Cross-origin resources without a Timing-Allow-Origin header report
  // transferSize as 0 — we can't know their real size, so we count how many
  // bytes are "invisible" to this counter rather than silently under-report.
  networkUncounted: 0,
  storageUsageBytes: null as number | null,
  storageQuotaBytes: null as number | null,
};

let started = false;
let logTimer: ReturnType<typeof setInterval> | null = null;
let storageTimer: ReturnType<typeof setInterval> | null = null;

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** exp).toFixed(exp === 0 ? 0 : 2)} ${units[exp]}`;
}

function categorize(entry: PerformanceResourceTiming): ByteCategory {
  const initiator = entry.initiatorType;
  if (initiator === "audio" || initiator === "video" || /\.(mp3|wav|m4a|ogg|flac|aac)(\?|$)/i.test(entry.name)) {
    return "audio";
  }
  if (initiator === "img" || /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(entry.name)) {
    return "image";
  }
  if (entry.name.includes("/api/")) return "api";
  return "other";
}

function recordResourceEntry(entry: PerformanceResourceTiming) {
  // transferSize includes response headers and is 0 for cached-from-disk
  // responses (still counts as "no new bytes over the wire", which is what
  // we actually care about for mobile data usage) and for opaque
  // cross-origin responses missing Timing-Allow-Origin.
  const size = entry.transferSize || 0;
  if (size === 0 && entry.decodedBodySize === 0 && entry.encodedBodySize === 0) {
    // Genuinely unknown (opaque cross-origin) rather than "0 bytes, served
    // from cache" — decodedBodySize is also blocked for those responses.
    state.networkUncounted += 1;
    return;
  }
  state.networkBytes += size;
  state.networkBytesByCategory[categorize(entry)] += size;
}

async function refreshStorageEstimate() {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    state.storageUsageBytes = usage ?? null;
    state.storageQuotaBytes = quota ?? null;
  } catch {
    // storage estimate unsupported/blocked — leave as null.
  }
}

function isVisibleNow() {
  return typeof document !== "undefined" && document.visibilityState === "visible";
}

function accrueVisibilityTime() {
  const now = Date.now();
  const delta = now - state.lastVisibilityChangeAt;
  if (isVisibleNow()) {
    // We just transitioned away from hidden, so the elapsed time was hidden.
    state.hiddenMs += delta;
  } else {
    state.visibleMs += delta;
  }
  state.lastVisibilityChangeAt = now;
}

function getSnapshot(): PerfSnapshot {
  // Include time since the last transition without mutating state, so
  // reading a snapshot doesn't itself perturb the counters.
  const now = Date.now();
  const pendingDelta = now - state.lastVisibilityChangeAt;
  const visibleMs = state.visibleMs + (isVisibleNow() ? pendingDelta : 0);
  const hiddenMs = state.hiddenMs + (isVisibleNow() ? 0 : pendingDelta);

  return {
    sessionStartedAt: state.sessionStartedAt,
    uptimeMs: now - state.sessionStartedAt,
    visibleMs,
    hiddenMs,
    longTaskCount: state.longTaskCount,
    longTaskTotalMs: Math.round(state.longTaskTotalMs),
    longTaskMaxMs: Math.round(state.longTaskMaxMs),
    networkBytes: state.networkBytes,
    networkBytesByCategory: { ...state.networkBytesByCategory },
    networkBytesFormatted: formatBytes(state.networkBytes),
    networkUncounted: state.networkUncounted,
    storageUsageBytes: state.storageUsageBytes,
    storageQuotaBytes: state.storageQuotaBytes,
    storageUsageFormatted: state.storageUsageBytes === null ? null : formatBytes(state.storageUsageBytes),
  };
}

function logSummary() {
  const s = getSnapshot();
  // eslint-disable-next-line no-console
  console.log(
    `[perf] uptime=${(s.uptimeMs / 1000).toFixed(0)}s visible=${(s.visibleMs / 1000).toFixed(0)}s hidden=${(s.hiddenMs / 1000).toFixed(0)}s ` +
      `longTasks=${s.longTaskCount} (total=${s.longTaskTotalMs}ms max=${s.longTaskMaxMs}ms) ` +
      `network=${s.networkBytesFormatted} [audio=${formatBytes(s.networkBytesByCategory.audio)} image=${formatBytes(s.networkBytesByCategory.image)} api=${formatBytes(s.networkBytesByCategory.api)} other=${formatBytes(s.networkBytesByCategory.other)}]` +
      (s.networkUncounted > 0 ? ` (+${s.networkUncounted} uncounted cross-origin)` : "") +
      (s.storageUsageFormatted ? ` storage=${s.storageUsageFormatted}` : ""),
  );
}

export function initPerfMonitor() {
  if (started || typeof window === "undefined") return;
  started = true;

  document.addEventListener("visibilitychange", accrueVisibilityTime);

  // "longtask" entries are >50ms main-thread blocks — the same kind of work
  // (uncapped rAF loops, dense timers, layout thrash) that keeps the CPU/GPU
  // busy and drains mobile battery. Not supported in every browser, so this
  // is best-effort.
  if ("PerformanceObserver" in window) {
    try {
      const longtaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          state.longTaskCount += 1;
          state.longTaskTotalMs += entry.duration;
          state.longTaskMaxMs = Math.max(state.longTaskMaxMs, entry.duration);
        }
      });
      longtaskObserver.observe({ type: "longtask", buffered: true });
    } catch {
      // longtask not supported in this browser — skip silently.
    }

    try {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
          recordResourceEntry(entry);
        }
      });
      resourceObserver.observe({ type: "resource", buffered: true });
    } catch {
      // resource timing unsupported — network byte tracking stays at 0.
    }
  }

  // Storage estimate is async and not event-driven, so poll it occasionally
  // rather than on every render. This reflects the PWA's cached audio/cover
  // assets and any IndexedDB usage — actual on-device footprint, distinct
  // from the network-bytes counter above (which is this-session traffic).
  void refreshStorageEstimate();
  storageTimer = setInterval(refreshStorageEstimate, 60_000);

  (window as any).__melodiqPerf = {
    snapshot: getSnapshot,
    formatBytes,
    setLogging(enabled: boolean) {
      state.loggingEnabled = enabled;
      if (enabled && !logTimer) {
        logTimer = setInterval(logSummary, 30_000);
      } else if (!enabled && logTimer) {
        clearInterval(logTimer);
        logTimer = null;
      }
    },
  };

  if (state.loggingEnabled) {
    logTimer = setInterval(logSummary, 30_000);
  }
}
