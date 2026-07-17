"use client";

export type SettingsSectionId = "providers" | "ai-routing" | "storage" | "playback" | "data" | "advanced";
export type ProvidersTabId = "music" | "llm" | "images";

const SECTIONS: { id: SettingsSectionId; label: string }[] = [
  { id: "providers", label: "Providers" },
  { id: "ai-routing", label: "AI Routing" },
  { id: "storage", label: "Storage" },
  { id: "playback", label: "Playback" },
  { id: "data", label: "Data" },
  { id: "advanced", label: "Advanced" },
];

export function SettingsSidebar({
  active,
  onChange,
}: {
  active: SettingsSectionId;
  onChange: (id: SettingsSectionId) => void;
}) {
  return (
    <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 lg:w-44 shrink-0">
      {SECTIONS.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onChange(section.id)}
          className={`shrink-0 text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            active === section.id ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white/80"
          }`}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}

const PROVIDER_TABS: { id: ProvidersTabId; label: string }[] = [
  { id: "music", label: "Music" },
  { id: "llm", label: "LLM" },
  { id: "images", label: "Images" },
];

export function ProvidersTabBar({
  active,
  onChange,
}: {
  active: ProvidersTabId;
  onChange: (id: ProvidersTabId) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-white/10 mb-4">
      {PROVIDER_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            active === tab.id
              ? "border-primary-500 text-white"
              : "border-transparent text-white/40 hover:text-white/70"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
