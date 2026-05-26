type ApiLoggingCardProps = {
  enabled: boolean;
  saving: boolean;
  onToggle: () => void;
  onSave: () => void;
};

export default function ApiLoggingCard({ enabled, saving, onToggle, onSave }: ApiLoggingCardProps) {
  return (
    <section className="section-card">
      <h2 className="text-sm font-semibold mb-3">API Logging</h2>
      <p className="text-xs text-white/40 mb-3">
        Store provider requests and responses in Logs for debugging.
      </p>
      <div className="space-y-3">
        <label className="flex items-center justify-between gap-3">
          <span className="text-xs text-white/70">Enable API logging</span>
          <button
            type="button"
            aria-label="Toggle API logging"
            onClick={onToggle}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              enabled ? "bg-emerald-500/20" : "bg-white/10"
            }`}
          >
            <span className="sr-only">Enable API logging</span>
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                enabled ? "translate-x-6" : ""
              }`}
            />
          </button>
        </label>
        <div className="flex items-center gap-2 pt-1">
          <button onClick={onSave} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </section>
  );
}
