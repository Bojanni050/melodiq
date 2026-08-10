"use client";

const PROVIDERS = {
  lyria: { name: "Lyria", fullName: "Google Lyria 3", models: ["lyria-3-pro-preview", "lyria-3-clip-preview"], icon: "G" },
  poyo: { name: "PoYo", fullName: "PoYo (Suno)", models: ["v5.5", "v5", "v4.5", "v4", "minimax-music-2.6"], icon: "P" },
  tempolor: { name: "Tempolor", fullName: "Tempolor", models: ["TemPolor v4.6", "TemPolor v3.5", "TemPolor v3", "TemPolor i3.5", "TemPolor i3", "Mureka (MK)", "MiniMax Music (MM)", "Google Lyria 3 Pro (LY)"], icon: "T" },
  musicgpt: { name: "MusicGPT", fullName: "MusicGPT v6", models: ["v6"], icon: "M" },
  minimax: { name: "Minimax", fullName: "MiniMax Music 2.6", models: ["music-2.6"], icon: "X" },
  mureka: { name: "Mureka", fullName: "Mureka V9 (WaveSpeed)", models: ["mureka-v9"], icon: "W" },
  heartmula: { name: "HeartMuLa", fullName: "HeartMuLa (WaveSpeed)", models: ["heartmula"], icon: "H" },
  apiframe: { name: "APIFrame", fullName: "APIFrame AI", models: ["Suno (suno)", "Udio (udio)", "Mureka (mureka)", "Google Lyria 3 Pro (lyria-3-pro)", "ElevenLabs Music (elevenlabs-music)"], icon: "A" },
  apimart: { name: "APIMart", fullName: "APIMart (Suno)", models: ["v5.5", "v5", "v4.5-all", "v4.5+", "v4.5", "v4", "v3.5"], icon: "AM" },
} as const;

export type ProviderKey = keyof typeof PROVIDERS;
export { PROVIDERS };

export interface ProviderCredits {
  lyria: string | number;
  poyo: number | null;
  tempolor: number | null;
  apiframe: number | null;
  apimart: number | null;
}

export default function ProviderModelSection({
  credits,
  selectedProviders,
  rememberProviderChoice,
  setProvider,
  setProviderModel,
  setRememberProviderChoice,
}: {
  credits: ProviderCredits;
  selectedProviders: Record<string, string>;
  rememberProviderChoice: boolean;
  setProvider: (key: string, model: string) => void;
  setProviderModel: (key: string, model: string) => void;
  setRememberProviderChoice: (v: boolean) => void;
}) {
  const activeProviderKey = Object.keys(selectedProviders)[0];

  return (
    <section className="section-card lg:sticky lg:top-0 lg:z-20 lg:bg-[#0a0a0f]/98 lg:backdrop-blur-sm lg:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      <h3 className="text-sm font-semibold text-white/80 mb-3">Provider & Model</h3>
      <div className="flex gap-2">
        <select
          value={activeProviderKey || ""}
          onChange={(e) => {
            const key = e.target.value;
            if (key) {
              setProvider(key, PROVIDERS[key as ProviderKey].models[0]);
            }
          }}
          aria-label="Select provider"
          className="select-field text-sm flex-1"
        >
          <option value="" className="bg-gray-900">Select provider...</option>
          {Object.entries(PROVIDERS)
            .sort(([, a], [, b]) => a.fullName.localeCompare(b.fullName))
            .map(([key, val]) => (
              <option key={key} value={key} className="bg-gray-900">
                {val.fullName}
              </option>
            ))}
        </select>
        {activeProviderKey && (
          <select
            value={selectedProviders[activeProviderKey]}
            onChange={(e) => setProviderModel(activeProviderKey, e.target.value)}
            aria-label="Select model"
            className="select-field text-sm flex-1"
          >
            {PROVIDERS[activeProviderKey as ProviderKey]?.models.map((model) => (
              <option key={model} value={model} className="bg-gray-900">
                {model}
              </option>
            ))}
          </select>
        )}
      </div>
      <label className="mt-2 flex items-center gap-1.5 text-xs text-white/40 cursor-pointer select-none w-fit">
        <input
          type="checkbox"
          checked={rememberProviderChoice}
          onChange={(e) => setRememberProviderChoice(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-white/20 bg-transparent accent-primary-500"
        />
        Remember choice
      </label>
      {activeProviderKey && (
        <div className="mt-2 text-xs text-white/30">
          {(() => {
            const currentCredits = credits[activeProviderKey as keyof ProviderCredits];
            if (activeProviderKey === "lyria") return "Pay-per-use";
            if (activeProviderKey === "apiframe") {
              return currentCredits !== null && currentCredits !== undefined
                ? `Active (Limit: ${currentCredits} concurrent jobs)`
                : "Not configured";
            }
            return currentCredits !== null && currentCredits !== undefined ? `${currentCredits} credits` : "Not configured";
          })()}
        </div>
      )}
    </section>
  );
}
