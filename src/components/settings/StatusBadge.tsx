export type ProviderStatus = "not-configured" | "configured" | "connected" | "invalid";

const STYLES: Record<ProviderStatus, { label: string; dot: string; text: string; bg: string }> = {
  "not-configured": { label: "Not configured", dot: "bg-white/30", text: "text-white/40", bg: "bg-white/5" },
  configured: { label: "Configured", dot: "bg-blue-400", text: "text-blue-300", bg: "bg-blue-500/10" },
  connected: { label: "Connected", dot: "bg-green-400", text: "text-green-300", bg: "bg-green-500/10" },
  invalid: { label: "Invalid API Key", dot: "bg-red-400", text: "text-red-300", bg: "bg-red-500/10" },
};

export default function StatusBadge({ status }: { status: ProviderStatus }) {
  const style = STYLES[status];
  return (
    <span className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}
