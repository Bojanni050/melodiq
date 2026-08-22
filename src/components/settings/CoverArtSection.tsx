"use client";

import ProviderAccordion from "@/components/settings/ProviderAccordion";
import type { ProviderStatus } from "@/components/settings/StatusBadge";

export default function CoverArtSection({
  value,
  onChange,
  providerValue,
  onProviderChange,
}: {
  value: string;
  onChange: (value: string) => void;
  providerValue: string;
  onProviderChange: (value: string) => void;
}) {
  const status: ProviderStatus = value ? "configured" : "not-configured";

  return (
    <ProviderAccordion title="Cover Art" description="AI-generated cover art for tracks and releases" status={status}>
      <div>
        <label className="text-sm text-white/50 mb-1 block">Image generation provider</label>
        <select
          value={providerValue || "pixazo"}
          onChange={(e) => onProviderChange(e.target.value)}
          className="select-field font-mono text-sm"
        >
          <option value="pixazo">Pixazo (Flux 1 Schnell)</option>
        </select>
        <p className="text-xs text-white/30 mt-1">Generates the actual cover image from the prompt an LLM writes.</p>
      </div>
      <div>
        <label className="text-sm text-white/50 mb-1 block">Pixazo API Key</label>
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your Pixazo subscription key"
          className="input-field"
        />
        <p className="text-xs text-white/30 mt-1">Get your key at pixazo.ai · Flux 1 Schnell is free</p>
      </div>
    </ProviderAccordion>
  );
}
