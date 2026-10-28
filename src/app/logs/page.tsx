"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { useSidebarStore } from "@/lib/store";

interface ApiLog {
  id: string;
  type: string;
  provider: string;
  endpoint: string;
  request: string;
  response: string | null;
  statusCode: number | null;
  duration: number | null;
  createdAt: string;
}

type LogTab = "api" | "track-dna";

/** Splits `[timestamp] message` and classifies the line for colouring. */
function parseDnaLine(line: string): { timestamp: string; message: string; kind: "error" | "skip" | "ok" | "" } {
  const match = line.match(/^\[([^\]]+)\]\s?(.*)$/);
  const message = match?.[2] ?? line;
  let kind: "error" | "skip" | "ok" | "" = "";
  if (/failed|error|could not/i.test(message)) kind = "error";
  else if (/skip/i.test(message)) kind = "skip";
  else if (/success|saved|using cached/i.test(message)) kind = "ok";
  return { timestamp: match?.[1] ?? "", message, kind };
}

export default function LogsPage() {
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<LogTab>("api");
  const [dnaLines, setDnaLines] = useState<string[]>([]);
  const [dnaLoading, setDnaLoading] = useState(false);
  const [dnaError, setDnaError] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchDnaLogs() {
    setDnaLoading(true);
    try {
      const res = await fetch("/api/logs/track-dna?limit=300");
      if (res.ok) {
        const data = await res.json();
        setDnaLines(data.lines);
        setDnaError(false);
      } else {
        setDnaError(true);
      }
    } catch {
      setDnaError(true);
    }
    setDnaLoading(false);
  }

  async function fetchLogs() {
    const res = await fetch("/api/logs?limit=100");
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs);
      setExpandedLogIds(new Set());
    }
    setLoading(false);
  }

  function formatDuration(ms: number | null) {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString();
  }

  function formatPayload(payload: string | null) {
    if (!payload) return "-";

    try {
      const parsed = JSON.parse(payload);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return payload;
    }
  }

  function toggleLog(logId: string) {
    setExpandedLogIds((current) => {
      const next = new Set(current);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  }

  return (
    <div className="h-screen bg-canvas overflow-hidden">
      <Sidebar credits={null} />
      <div className="h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] overflow-y-auto pt-[53px] lg:pt-0" style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? "var(--sidebar-collapsed)" : isQHD ? "var(--sidebar-width-qhd)" : "var(--sidebar-width)" }}>
        <div className="sticky top-0 z-20 bg-canvas/95 backdrop-blur-sm border-b border-line">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold">API Logs</h1>
              <div className="flex gap-1">
                <button
                  onClick={() => setTab("api")}
                  className={`text-xs px-2.5 py-1 rounded ${tab === "api" ? "bg-white/10 text-ink" : "text-ink-dim hover:bg-white/[0.04]"}`}
                >
                  Provider calls
                </button>
                <button
                  onClick={() => {
                    setTab("track-dna");
                    if (dnaLines.length === 0) fetchDnaLogs();
                  }}
                  className={`text-xs px-2.5 py-1 rounded ${tab === "track-dna" ? "bg-white/10 text-ink" : "text-ink-dim hover:bg-white/[0.04]"}`}
                >
                  Track DNA
                </button>
              </div>
            </div>
            {tab === "api" ? (
              <button onClick={fetchLogs} className="btn-secondary text-xs px-3 py-1.5">
                Refresh
              </button>
            ) : (
              <button onClick={fetchDnaLogs} className="btn-secondary text-xs px-3 py-1.5">
                Refresh
              </button>
            )}
          </div>
        </div>
        <main className="p-4">
          {tab === "track-dna" ? (
            dnaLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-line/20 border-t-white/60 rounded-full animate-spin" />
              </div>
            ) : dnaError ? (
              <div className="text-center py-16">
                <p className="text-ink-dim text-sm">Could not load Track DNA logs</p>
                <p className="text-ink-dim text-xs mt-1">Check that the log file exists (data/logs/track-dna.log)</p>
              </div>
            ) : dnaLines.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-ink-dim text-sm">No Track DNA logs yet</p>
                <p className="text-ink-dim text-xs mt-1">Run a Track DNA analysis (basic or advanced) first</p>
              </div>
            ) : (
              <div className="border border-line rounded-lg bg-surface overflow-hidden divide-y divide-line/60">
                {dnaLines
                  .slice()
                  .reverse()
                  .map((line, i) => {
                    const { timestamp, message, kind } = parseDnaLine(line);
                    const colour =
                      kind === "error"
                        ? "text-red-400"
                        : kind === "skip"
                          ? "text-ink-dim"
                          : kind === "ok"
                            ? "text-green-400"
                            : "text-ink-muted";
                    return (
                      <div key={i} className="px-3 py-1.5 font-mono text-[11px] leading-4 break-all flex gap-2">
                        <span className="text-ink-dim/70 shrink-0">{timestamp}</span>
                        <span className={colour}>{message}</span>
                      </div>
                    );
                  })}
              </div>
            )
          ) : loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-line/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-ink-dim text-sm">No logs yet</p>
              <p className="text-ink-dim text-xs mt-1">Enable API logging in Settings</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const isExpanded = expandedLogIds.has(log.id);
                const isSuccess = Boolean(log.statusCode && log.statusCode >= 200 && log.statusCode < 300);

                return (
                  <section key={log.id} className="section-card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleLog(log.id)}
                      className="w-full px-3 py-2.5 text-left hover:bg-white/[0.02] transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-ink-dim">{formatDate(log.createdAt)}</p>
                          <p className="mt-1 font-mono text-xs text-ink-muted truncate">{log.endpoint}</p>
                          <p className="mt-1 text-xs text-ink/55 capitalize">
                            {log.type} • {log.provider}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs ${
                              isSuccess ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {log.statusCode || "-"}
                          </span>
                          <span className="text-xs text-ink-dim">{formatDuration(log.duration)}</span>
                          <span className="text-xs text-ink-dim">{isExpanded ? "Hide" : "Show"}</span>
                        </div>
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="border-t border-line px-3 py-3 grid gap-3 lg:grid-cols-2">
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wide text-ink-dim mb-1.5">Input</p>
                          <pre className="w-full overflow-x-auto  border border-line bg-surface p-3 text-xs text-ink-muted leading-5 whitespace-pre-wrap break-words">
                            {formatPayload(log.request)}
                          </pre>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wide text-ink-dim mb-1.5">Output</p>
                          <pre className="w-full overflow-x-auto  border border-line bg-surface p-3 text-xs text-ink-muted leading-5 whitespace-pre-wrap break-words">
                            {formatPayload(log.response)}
                          </pre>
                        </div>
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
