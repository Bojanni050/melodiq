"use client";

import { useState } from "react";
import ProviderAccordion from "@/components/settings/ProviderAccordion";
import type { ProviderConfig } from "@/lib/settings-constants";
import type { ProviderStatus } from "@/components/settings/StatusBadge";

export default function ProviderSection({
  provider,
  values,
  onFieldChange,
  onGetModels,
  testingModels,
}: {
  provider: ProviderConfig;
  values: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  onGetModels?: () => void;
  testingModels?: boolean;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleTest() {
    setTesting(true);
    const apiKey = values[provider.fields[0].key] || "";
    const res = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: provider.testEndpoint, apiKey }),
    });
    const data = await res.json();
    setTestResult({ success: data.success, message: data.message });
    setTesting(false);
  }

  const apiKeyValue = values[provider.fields[0].key] || "";
  const status: ProviderStatus = !apiKeyValue
    ? "not-configured"
    : testResult
      ? testResult.success
        ? "connected"
        : "invalid"
      : "configured";

  return (
    <ProviderAccordion title={provider.name} description={provider.description} status={status}>
      {provider.fields.map((field) => (
        <div key={field.key}>
          <label className="block text-xs font-medium text-white/50 mb-1">{field.label}</label>
          <input
            type={field.type}
            value={values[field.key] || ""}
            onChange={(e) => onFieldChange(field.key, e.target.value)}
            className="input-field font-mono text-sm"
            placeholder={field.placeholder}
          />
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <button onClick={handleTest} disabled={testing} className="btn-secondary text-xs px-3 py-1.5">
          {testing ? "Testing..." : "Test Connection"}
        </button>
        {provider.id === "openrouter" && onGetModels && (
          <button onClick={onGetModels} disabled={testingModels} className="btn-secondary text-xs px-3 py-1.5">
            {testingModels ? "Loading Models..." : "Retrieve Models"}
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
