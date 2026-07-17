"use client";

import ProviderAccordion from "@/components/settings/ProviderAccordion";
import type { ProviderStatus } from "@/components/settings/StatusBadge";

export default function CoverArtSection({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const status: ProviderStatus = value ? "configured" : "not-configured";

  return (
    <ProviderAccordion title="Cover Art (Pixazo)" description="AI-generated cover art via Pixazo Flux 1 Schnell (free)" status={status}>
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
    </ProviderAccordion>
  );
}
