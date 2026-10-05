"use client";

import { usePlayerStore } from "@/lib/store";

const MODES = [
  { value: 0,  label: "Discrete", description: "Individual frequency bars" },
  { value: 2,  label: "Bars",     description: "1/12 octave bands" },
  { value: 6,  label: "Wide Bars",description: "1/3 octave bands" },
  { value: 10, label: "Line",     description: "Line / area graph" },
];

const GRADIENTS = [
  { value: "prism",     label: "Prism" },
  { value: "classic",   label: "Classic" },
  { value: "rainbow",   label: "Rainbow" },
  { value: "orangered", label: "Orange Red" },
  { value: "steelblue", label: "Steel Blue" },
  { value: "cover",     label: "Cover Art" },
];

export default function VisualizerSection() {
  const { visualizerEnabled, visualizerMode, visualizerGradient, setVisualizerEnabled, setVisualizerMode, setVisualizerGradient } =
    usePlayerStore();

  return (
    <div className="bg-white/5  p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Audio Visualizer</h2>
          <p className="text-sm text-ink-dim mt-0.5">
            Frequency spectrum shown in the fullscreen player.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setVisualizerEnabled(!visualizerEnabled)}
          className={`shrink-0 w-10 h-6 rounded-full transition-colors relative ${visualizerEnabled ? "bg-accent" : "bg-white/20"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${visualizerEnabled ? "translate-x-4" : "translate-x-0"}`}
          />
        </button>
      </div>

      {visualizerEnabled && (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink-dim uppercase tracking-wider">Type</p>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setVisualizerMode(m.value)}
                  className={`text-left px-3 py-2.5  border transition-colors ${
                    visualizerMode === m.value
                      ? "border-accent bg-accent/10 text-ink"
                      : "border-line bg-white/5 text-ink-muted hover:border-line/25 hover:text-ink"
                  }`}
                >
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className="block text-[10px] text-ink-dim mt-0.5">{m.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-ink-dim uppercase tracking-wider">Color</p>
            <div className="flex flex-wrap gap-2">
              {GRADIENTS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setVisualizerGradient(g.value)}
                  className={`px-3 py-1.5  text-sm border transition-colors ${
                    visualizerGradient === g.value
                      ? "border-accent bg-accent/10 text-ink"
                      : "border-line bg-white/5 text-ink-muted hover:border-line/25 hover:text-ink"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
