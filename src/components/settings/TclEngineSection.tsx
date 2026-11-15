"use client";

const ENGINE_OPTIONS = [
  { value: "elevenlabs", label: "ElevenLabs (default)" },
  { value: "quicklrc", label: "QuickLRC" },
];

export default function TclEngineSection({
  value,
  onChange,
  autoEnabled,
  onAutoToggle,
}: {
  value: string;
  onChange: (value: string) => void;
  autoEnabled: boolean;
  onAutoToggle: () => void;
}) {
  return (
    <>
      <section className="section-card">
        <h2 className="text-sm font-semibold mb-1">Time Coded Lyrics Engine</h2>
        <p className="text-sm text-ink-dim mb-3">
          Which forced-alignment service generates time-coded lyrics. Configure the matching provider&apos;s API key on the Music tab.
        </p>
        <div>
          <label className="text-sm text-ink-dim mb-1 block">Active engine</label>
          <select
            value={value || "elevenlabs"}
            onChange={(e) => onChange(e.target.value)}
            className="select-field font-mono text-sm"
          >
            {ENGINE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="section-card">
        <h2 className="text-sm font-semibold mb-1">Automatic Time Coded Lyrics</h2>
        <p className="text-sm text-ink-dim mb-3">
          Asks the generation provider for its time-coded lyrics on every new track once the audio is ready. Turn this off to skip that
          request; the &quot;Generate time-coded lyrics&quot; action in a track&apos;s menu still works with the engine above.
        </p>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-ink-muted">Fetch time-coded lyrics automatically</span>
          <button
            type="button"
            aria-label="Toggle automatic time-coded lyrics"
            aria-pressed={autoEnabled}
            onClick={onAutoToggle}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              autoEnabled ? "bg-emerald-500/20" : "bg-white/10"
            }`}
          >
            <span className="sr-only">Fetch time-coded lyrics automatically</span>
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                autoEnabled ? "translate-x-6" : ""
              }`}
            />
          </button>
        </label>
      </section>
    </>
  );
}
