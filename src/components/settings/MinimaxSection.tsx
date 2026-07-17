"use client";

import { useState } from "react";
import ProviderAccordion from "@/components/settings/ProviderAccordion";
import type { ProviderStatus } from "@/components/settings/StatusBadge";

export default function MinimaxSection({
  values,
  onFieldChange,
}: {
  values: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  async function toggleUsePoyo() {
    const next = values.MINIMAX_USE_POYO === "true" ? "false" : "true";
    onFieldChange("MINIMAX_USE_POYO", next);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "MINIMAX_USE_POYO", value: next }),
    });
  }

  async function handleTest() {
    setTesting(true);
    const res = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "minimax", apiKey: values.MINIMAX_API_KEY || "" }),
    });
    const data = await res.json();
    setTestResult({ success: data.success, message: data.message });
    setTesting(false);
  }

  const usesPoyo = values.MINIMAX_USE_POYO === "true";
  const status: ProviderStatus = usesPoyo
    ? "configured"
    : !values.MINIMAX_API_KEY
      ? "not-configured"
      : testResult
        ? testResult.success
          ? "connected"
          : "invalid"
        : "configured";

  return (
    <ProviderAccordion title="MiniMax Music 2.6" description="Synchronous music generation with lyrics support" status={status}>
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10">
        <div>
          <p className="text-sm text-white/80">Use PoYo</p>
          <p className="text-xs text-white/30">Route Minimax generation through PoYo API</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={usesPoyo}
          onClick={toggleUsePoyo}
          className={`relative w-12 h-6 rounded-full transition-colors ${usesPoyo ? "bg-primary-500/40" : "bg-white/10"}`}
        >
          <span className="sr-only">Use PoYo for Minimax</span>
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${usesPoyo ? "translate-x-6" : ""}`}
          />
        </button>
      </div>

      {!usesPoyo && (
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1">API Key</label>
          <input
            type="password"
            value={values.MINIMAX_API_KEY || ""}
            onChange={(e) => onFieldChange("MINIMAX_API_KEY", e.target.value)}
            className="input-field font-mono text-sm"
            placeholder="minimax_..."
          />
        </div>
      )}

      {usesPoyo && (
        <p className="text-xs text-white/30">
          Using PoYo API key for Minimax generation. Ensure PoYo is configured above.
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        {!usesPoyo && (
          <button onClick={handleTest} disabled={testing} className="btn-secondary text-xs px-3 py-1.5">
            {testing ? "Testing..." : "Test Connection"}
          </button>
        )}
      </div>

      {testResult && (
        <p className={`text-xs ${testResult.success ? "text-green-400" : "text-red-400"}`}>
          {testResult.message}
        </p>
      )}
    </ProviderAccordion>
  );
}
