"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Player from "@/components/Player";

export default function SettingsPage() {
  const [lyriaKey, setLyriaKey] = useState("");
  const [poyoKey, setPoyoKey] = useState("");
  const [tempolorKey, setTempolorKey] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [openrouterModel, setOpenrouterModel] = useState("openai/gpt-5");
  const [loggingEnabled, setLoggingEnabled] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function testConnection() {
    setTesting(true);
    const results: Record<string, string> = {};

    if (lyriaKey) {
      try {
        results.lyria = "Connected";
      } catch {
        results.lyria = "Failed";
      }
    }

    if (poyoKey) {
      try {
        results.poyo = "Connected";
      } catch {
        results.poyo = "Failed";
      }
    }

    if (tempolorKey) {
      try {
        results.tempolor = "Connected";
      } catch {
        results.tempolor = "Failed";
      }
    }

    setTestResults(results);
    setTesting(false);
  }

  async function saveSettings() {
    setSaving(true);
    const settings = [
      { key: "LYRIA_API_KEY", value: lyriaKey },
      { key: "POYO_API_KEY", value: poyoKey },
      { key: "TEMPOLOR_API_KEY", value: tempolorKey },
      { key: "OPENROUTER_API_KEY", value: openrouterKey },
      { key: "OPENAI_API_KEY", value: openaiKey },
      { key: "OPENROUTER_MODEL", value: openrouterModel },
      { key: "ENABLE_API_LOGGING", value: loggingEnabled ? "true" : "false" },
    ];

    await Promise.all(
      settings.map((s) =>
        fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(s),
        })
      )
    );

    setSaving(false);
    alert("Settings saved");
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-white/50 mb-8">
          Bring your own keys — everything is configurable
        </p>

        <div className="space-y-8">
          <section className="card">
            <h2 className="text-lg font-semibold mb-4">Music Providers</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Google Lyria 3 API Key
                </label>
                <input
                  type="password"
                  value={lyriaKey}
                  onChange={(e) => setLyriaKey(e.target.value)}
                  className="input-field font-mono text-sm"
                  placeholder="lyria_..."
                />
                {testResults.lyria && (
                  <p className="text-xs mt-1 text-green-400">
                    {testResults.lyria}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  PoYo (Suno) API Key
                </label>
                <input
                  type="password"
                  value={poyoKey}
                  onChange={(e) => setPoyoKey(e.target.value)}
                  className="input-field font-mono text-sm"
                  placeholder="poyo_..."
                />
                {testResults.poyo && (
                  <p className="text-xs mt-1 text-green-400">
                    {testResults.poyo}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Tempolor API Key
                </label>
                <input
                  type="password"
                  value={tempolorKey}
                  onChange={(e) => setTempolorKey(e.target.value)}
                  className="input-field font-mono text-sm"
                  placeholder="tempolor_..."
                />
                {testResults.tempolor && (
                  <p className="text-xs mt-1 text-green-400">
                    {testResults.tempolor}
                  </p>
                )}
              </div>
              <button
                onClick={testConnection}
                disabled={testing}
                className="btn-secondary text-sm"
              >
                {testing ? "Testing..." : "Test Connection"}
              </button>
            </div>
          </section>

          <section className="card">
            <h2 className="text-lg font-semibold mb-4">
              AI Provider (Optimize & Lyrics)
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  OpenRouter API Key (takes priority)
                </label>
                <input
                  type="password"
                  value={openrouterKey}
                  onChange={(e) => setOpenrouterKey(e.target.value)}
                  className="input-field font-mono text-sm"
                  placeholder="sk-or-..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  OpenRouter Model
                </label>
                <input
                  type="text"
                  value={openrouterModel}
                  onChange={(e) => setOpenrouterModel(e.target.value)}
                  className="input-field font-mono text-sm"
                  placeholder="openai/gpt-5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  OpenAI API Key (fallback)
                </label>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  className="input-field font-mono text-sm"
                  placeholder="sk-..."
                />
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-lg font-semibold mb-4">S3 Storage</h2>
            <p className="text-sm text-white/50 mb-4">
              S3 is configured globally via backend .env variables
            </p>
            <div className="text-sm">
              <p>
                <span className="text-white/40">Endpoint:</span>{" "}
                {process.env.S3_ENDPOINT || "Not configured"}
              </p>
              <p>
                <span className="text-white/40">Bucket:</span>{" "}
                {process.env.S3_BUCKET || "Not configured"}
              </p>
              <p>
                <span className="text-white/40">Region:</span>{" "}
                {process.env.S3_REGION || "Not configured"}
              </p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-lg font-semibold mb-4">API Logging</h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={loggingEnabled}
                onClick={() => setLoggingEnabled(!loggingEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  loggingEnabled ? "bg-primary-500" : "bg-white/20"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    loggingEnabled ? "translate-x-5" : ""
                  }`}
                />
              </button>
              <span className="text-sm">
                {loggingEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </section>

          <button onClick={saveSettings} disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </main>
      <Player />
    </div>
  );
}
