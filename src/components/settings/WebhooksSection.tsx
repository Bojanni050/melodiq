"use client";

import { useState } from "react";
import WebhookRow from "@/components/settings/WebhookRow";
import { WEBHOOK_DEFAULTS } from "@/lib/settings-constants";
import { buildWebhookUrl } from "@/lib/settings-utils";

export default function WebhooksSection({
  values,
  onFieldChange,
}: {
  values: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const appUrl = values.APP_URL?.trim();
    const webhookFields = ["APP_URL", "POYO_WEBHOOK_URL", "POYO_WAV_WEBHOOK_URL", "TEMPOLOR_WEBHOOK_URL", "MUSICGPT_WEBHOOK_URL", "MINIMAX_WEBHOOK_URL"];

    for (const key of webhookFields) {
      const value =
        key === "APP_URL" || !appUrl
          ? values[key] || ""
          : values[key] || buildWebhookUrl(appUrl, WEBHOOK_DEFAULTS.find((d) => d.key === key)?.path || "");

      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
    }
    setSaving(false);
  }

  const appUrl = values.APP_URL || "";

  return (
    <section className="section-card">
      <h2 className="text-sm font-semibold mb-3">Webhooks</h2>
      <p className="text-xs text-white/40 mb-3">
        Set your public app URL to auto-generate all webhook URLs, or override them individually.
      </p>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1">App URL</label>
          <input
            type="text"
            value={appUrl}
            onChange={(e) => onFieldChange("APP_URL", e.target.value)}
            className="input-field font-mono text-sm"
            placeholder="https://melodiq.yourdomain.com"
          />
          <p className="text-xs text-white/25 mt-1">Used to auto-derive webhook URLs below</p>
        </div>
        <WebhookRow
          label="PoYo Webhook URL"
          value={values.POYO_WEBHOOK_URL || ""}
          onChange={(v) => onFieldChange("POYO_WEBHOOK_URL", v)}
          placeholder={appUrl ? `${appUrl.replace(/\/$/, "")}/api/webhooks/poyo` : "Leave empty to auto-derive"}
        />
        <WebhookRow
          label="PoYo WAV Webhook URL"
          value={values.POYO_WAV_WEBHOOK_URL || ""}
          onChange={(v) => onFieldChange("POYO_WAV_WEBHOOK_URL", v)}
          placeholder={appUrl ? `${appUrl.replace(/\/$/, "")}/api/webhooks/poyo-wav` : "Leave empty to auto-derive"}
        />
        <WebhookRow
          label="Tempolor Webhook URL"
          value={values.TEMPOLOR_WEBHOOK_URL || ""}
          onChange={(v) => onFieldChange("TEMPOLOR_WEBHOOK_URL", v)}
          placeholder={appUrl ? `${appUrl.replace(/\/$/, "")}/api/webhooks/tempolor` : "Leave empty to auto-derive"}
        />
        <WebhookRow
          label="MusicGPT Webhook URL"
          value={values.MUSICGPT_WEBHOOK_URL || ""}
          onChange={(v) => onFieldChange("MUSICGPT_WEBHOOK_URL", v)}
          placeholder={appUrl ? `${appUrl.replace(/\/$/, "")}/api/webhooks/musicgpt` : "Leave empty to auto-derive"}
        />
        <WebhookRow
          label="MiniMax Webhook URL"
          value={values.MINIMAX_WEBHOOK_URL || ""}
          onChange={(v) => onFieldChange("MINIMAX_WEBHOOK_URL", v)}
          placeholder={appUrl ? `${appUrl.replace(/\/$/, "")}/api/webhooks/minimax` : "Leave empty to auto-derive"}
        />
        <div className="flex items-center gap-2 pt-1">
          <button onClick={handleSave} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
            {saving ? "Saving..." : "Save Webhooks"}
          </button>
        </div>
      </div>
    </section>
  );
}
