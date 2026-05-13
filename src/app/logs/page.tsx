"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Player from "@/components/Player";

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
    <div className="min-h-screen">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">API Logs</h1>
            <p className="text-white/50">
              Provider calls, webhook receipts, S3 uploads, and LLM dispatches
            </p>
          </div>
          <button onClick={fetchLogs} className="btn-secondary text-sm">
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-center py-8">Loading...</p>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-white/40 text-lg">No logs yet</p>
            <p className="text-white/30 text-sm mt-1">
              Enable API logging in Settings to start capturing
            </p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-white/50 font-medium">Time</th>
                  <th className="text-left py-2 px-3 text-white/50 font-medium">Type</th>
                  <th className="text-left py-2 px-3 text-white/50 font-medium">Provider</th>
                  <th className="text-left py-2 px-3 text-white/50 font-medium">Endpoint</th>
                  <th className="text-left py-2 px-3 text-white/50 font-medium">Status</th>
                  <th className="text-left py-2 px-3 text-white/50 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 px-3 text-white/60">{formatDate(log.createdAt)}</td>
                    <td className="py-2 px-3 capitalize">{log.type}</td>
                    <td className="py-2 px-3 capitalize">{log.provider}</td>
                    <td className="py-2 px-3 font-mono text-xs">{log.endpoint}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          log.statusCode && log.statusCode >= 200 && log.statusCode < 300
                            ? "bg-green-500/20 text-green-300"
                            : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {log.statusCode || "-"}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-white/60">
                      {formatDuration(log.duration)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Player />
    </div>
  );
}
