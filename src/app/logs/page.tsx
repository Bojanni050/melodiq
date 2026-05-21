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

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    const res = await fetch("/api/logs?limit=100");
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs);
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

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Sidebar credits={null} />
      <div className="lg:ml-[240px]">
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
            <div className="section-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Time</th>
                    <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Type</th>
                    <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Provider</th>
                    <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Endpoint</th>
                    <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Status</th>
                    <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2 px-3 text-white/40 text-xs">{formatDate(log.createdAt)}</td>
                      <td className="py-2 px-3 capitalize text-xs">{log.type}</td>
                      <td className="py-2 px-3 capitalize text-xs">{log.provider}</td>
                      <td className="py-2 px-3 font-mono text-xs text-white/50">{log.endpoint}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs ${
                            log.statusCode && log.statusCode >= 200 && log.statusCode < 300
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {log.statusCode || "-"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-white/40 text-xs">{formatDuration(log.duration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
