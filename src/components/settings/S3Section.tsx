"use client";

import { useState } from "react";

export default function S3Section({
  values,
  onFieldChange,
}: {
  values: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [s3Status, setS3Status] = useState<{ connected: boolean; message: string } | null>(null);
  const [s3Stats, setS3Stats] = useState<{ totalSize: number; objectCount: number; formattedSize: string } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  async function handleSave() {
    setSaving(true);
    for (const key of ["S3_ENDPOINT", "AWS_REGION", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET"]) {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: values[key] || "" }),
      });
    }
    setSaving(false);
  }

  async function handleTest() {
    setTesting(true);
    setS3Status(null);
    const res = await fetch("/api/settings/s3", { method: "POST" });
    setS3Status(await res.json());
    setTesting(false);
  }

  async function handleFetchStats() {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/settings/s3/stats");
      if (res.ok) setS3Stats(await res.json());
    } catch {}
    setLoadingStats(false);
  }

  return (
    <section className="section-card">
      <h2 className="text-sm font-semibold mb-3">S3 Storage</h2>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1">Endpoint</label>
          <input type="text" value={values.S3_ENDPOINT || ""} onChange={(e) => onFieldChange("S3_ENDPOINT", e.target.value)} className="input-field font-mono text-sm" placeholder="https://s3.example.com or https://minio.local" />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1">Region</label>
          <input type="text" value={values.AWS_REGION || ""} onChange={(e) => onFieldChange("AWS_REGION", e.target.value)} className="input-field font-mono text-sm" placeholder="auto" />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1">Access Key</label>
          <input type="password" value={values.S3_ACCESS_KEY || ""} onChange={(e) => onFieldChange("S3_ACCESS_KEY", e.target.value)} className="input-field font-mono text-sm" placeholder="your-access-key" />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1">Secret Key</label>
          <input type="password" value={values.S3_SECRET_KEY || ""} onChange={(e) => onFieldChange("S3_SECRET_KEY", e.target.value)} className="input-field font-mono text-sm" placeholder="your-secret-key" />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1">Bucket Name</label>
          <input type="text" value={values.S3_BUCKET || ""} onChange={(e) => onFieldChange("S3_BUCKET", e.target.value)} className="input-field font-mono text-sm" placeholder="sonara-tracks" />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button onClick={handleSave} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={handleTest} disabled={testing} className="btn-secondary text-xs px-3 py-1.5">
            {testing ? "Testing..." : "Test Connection"}
          </button>
        </div>
        {s3Status && (
          <p className={`text-xs ${s3Status.connected ? "text-green-400" : "text-red-400"}`}>{s3Status.message}</p>
        )}
        {s3Stats && (
          <div className="mt-3 p-2 bg-white/5 rounded border border-white/10">
            <div className="text-xs space-y-1">
              <p className="text-white/60"><span className="text-white/40">Total Size:</span> <span className="text-white/80 font-mono">{s3Stats.formattedSize}</span></p>
              <p className="text-white/60"><span className="text-white/40">Objects:</span> <span className="text-white/80 font-mono">{s3Stats.objectCount.toLocaleString()}</span></p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          <button onClick={handleFetchStats} disabled={loadingStats} className="btn-secondary text-xs px-3 py-1.5">
            {loadingStats ? "Loading..." : "Refresh Storage Stats"}
          </button>
        </div>
      </div>
    </section>
  );
}
