type LlmLoggingCardProps = {
  enabled: boolean;
  onToggle: () => void;
};

export default function LlmLoggingCard({ enabled, onToggle }: LlmLoggingCardProps) {
  return (
    <section className="section-card">
      <h2 className="text-sm font-semibold mb-1">LLM Logging</h2>
      <p className="text-sm text-ink-dim mb-3">
        Log every LLM request and response (model, prompts, tokens, cost) in Logs.
      </p>
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink-muted">Enable LLM logging</span>
        <button
          type="button"
          aria-label="Toggle LLM logging"
          onClick={onToggle}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            enabled ? "bg-emerald-500/20" : "bg-white/10"
          }`}
        >
          <span className="sr-only">Enable LLM logging</span>
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-6" : ""
            }`}
          />
        </button>
      </label>
    </section>
  );
}
