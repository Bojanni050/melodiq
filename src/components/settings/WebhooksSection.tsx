"use client";

import ProviderAccordion from "@/components/settings/ProviderAccordion";
import WebhookRow from "@/components/settings/WebhookRow";

export default function WebhooksSection({
  values,
  onFieldChange,
}: {
  values: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
}) {
  const appUrl = values.APP_URL || "";

  return (
    <ProviderAccordion title="Webhooks" description="Auto-derive webhook URLs from your app URL, or override individually">
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
      <WebhookRow
        label="APIFrame Webhook URL"
        value={values.APIFRAME_WEBHOOK_URL || ""}
        onChange={(v) => onFieldChange("APIFRAME_WEBHOOK_URL", v)}
        placeholder={appUrl ? `${appUrl.replace(/\/$/, "")}/api/webhooks/apiframe` : "Leave empty to auto-derive"}
      />
    </ProviderAccordion>
  );
}
