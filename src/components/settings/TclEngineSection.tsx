"use client";

const ENGINE_OPTIONS = [
  { value: "elevenlabs", label: "ElevenLabs (default)" },
  { value: "quicklrc", label: "QuickLRC" },
];

export default function TclEngineSection({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="section-card">
      <h2 className="text-sm font-semibold mb-1">Time Coded Lyrics Engine</h2>
      <p className="text-sm text-white/40 mb-3">
        Which forced-alignment service generates time-coded lyrics. Configure the matching provider&apos;s API key on the Music tab.
      </p>
      <div>
        <label className="text-sm text-white/50 mb-1 block">Active engine</label>
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
  );
}
