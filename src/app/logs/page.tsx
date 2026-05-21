"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

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

export default function LogsPage() {
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchLogs();
  }, []);

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
    <div className="h-screen bg-[#0a0a0f] overflow-hidden">
      <Sidebar credits={null} />
      <div className="lg:ml-60 h-[calc(100vh-var(--player-height))] overflow-y-auto">
        <div className="sticky top-0 z-20 bg-[#0a0a0f]/95 backdrop-blur-sm border-b border-white/5">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <h1 className="text-lg font-bold">API Logs</h1>
              <p className="text-xs text-white/40 mt-0.5">Provider calls, webhooks, LLM dispatches</p>
            </div>
            <button onClick={fetchLogs} className="btn-secondary text-xs px-3 py-1.5">
              Refresh
            </button>
          </div>
        </div>
        <main className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-white/30 text-sm">No logs yet</p>
              <p className="text-white/20 text-xs mt-1">Enable API logging in Settings</p>
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
                          <p className="text-xs text-white/40">{formatDate(log.createdAt)}</p>
                          <p className="mt-1 font-mono text-xs text-white/70 truncate">{log.endpoint}</p>
                          <p className="mt-1 text-xs text-white/55 capitalize">
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
                          <span className="text-xs text-white/40">{formatDuration(log.duration)}</span>
                          <span className="text-xs text-white/50">{isExpanded ? "Hide" : "Show"}</span>
                        </div>
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="border-t border-white/5 px-3 py-3 grid gap-3 lg:grid-cols-2">
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wide text-white/45 mb-1.5">Input</p>
                          <pre className="w-full overflow-x-auto rounded-lg border border-white/10 bg-[#0f0f16] p-3 text-xs text-white/80 leading-5 whitespace-pre-wrap break-words">
                            {formatPayload(log.request)}
                          </pre>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wide text-white/45 mb-1.5">Output</p>
                          <pre className="w-full overflow-x-auto rounded-lg border border-white/10 bg-[#0f0f16] p-3 text-xs text-white/80 leading-5 whitespace-pre-wrap break-words">
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
