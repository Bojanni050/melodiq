"use client";

import { useState } from "react";

export default function CoverArtSection({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "PIXAZO_API_KEY", value }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <section className="section-card">
      <h2 className="text-sm font-semibold mb-3">Cover Art</h2>
      <p className="text-xs text-white/40 mb-3">AI-generated cover art via Pixazo Flux 1 Schnell (free).</p>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-white/50 mb-1 block">Pixazo API Key</label>
          <input
            type="password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Your Pixazo subscription key"
            className="input-field"
          />
          <p className="text-xs text-white/30 mt-1">Get your key at pixazo.ai · Flux 1 Schnell is free</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
          {saving ? "Saving..." : saved ? "✓ Saved" : "Save"}
        </button>
      </div>
    </section>
  );
}
