"use client";

export type SettingsSectionId = "providers" | "ai-routing" | "storage" | "playback" | "data" | "advanced";
export type ProvidersTabId = "music" | "llm" | "images";

function NavIcon({ id }: { id: SettingsSectionId }) {
  const cls = "w-4 h-4 shrink-0";
  switch (id) {
    case "providers":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case "ai-routing":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v4a1 1 0 01-1 1H4m16 12v-4a1 1 0 00-1-1h-4M9 21H5a1 1 0 01-1-1v-4m16-8V5a1 1 0 00-1-1h-4" />
        </svg>
      );
    case "storage":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7a8 3 0 0016 0M4 7a8 3 0 1116 0M4 7v10a8 3 0 0016 0V7" />
        </svg>
      );
    case "playback":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-6.518-3.76A1 1 0 007 8.24v7.52a1 1 0 001.234.972l6.518-1.628a1 1 0 00.75-.972v-2.972a1 1 0 00-.75-.972z" />
          <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
        </svg>
      );
    case "data":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
        </svg>
      );
    case "advanced":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
  }
}

const GROUPS: { label: string; sections: { id: SettingsSectionId; label: string }[] }[] = [
  {
    label: "Generation",
    sections: [
      { id: "providers", label: "Providers" },
      { id: "ai-routing", label: "AI Routing" },
    ],
  },
  {
    label: "Library",
    sections: [
      { id: "storage", label: "Storage" },
      { id: "playback", label: "Playback" },
      { id: "data", label: "Data" },
    ],
  },
  {
    label: "System",
    sections: [{ id: "advanced", label: "Advanced" }],
  },
];

export function SettingsSidebar({
  active,
  onChange,
  isListener = false,
}: {
  active: SettingsSectionId;
  onChange: (id: SettingsSectionId) => void;
  isListener?: boolean;
}) {
  const groups = isListener
    ? [
        {
          label: "Library",
          sections: [{ id: "playback" as SettingsSectionId, label: "Playback" }],
        },
      ]
    : GROUPS;
  return (
    <nav className="flex lg:flex-col gap-4 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 lg:w-56 shrink-0">
      {groups.map((group) => (
        <div key={group.label} className="shrink-0 lg:shrink lg:space-y-1">
          <p className="hidden lg:block px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/30">
            {group.label}
          </p>
          <div className="flex lg:flex-col gap-1">
            {group.sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => onChange(section.id)}
                className={`shrink-0 flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active === section.id ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <NavIcon id={section.id} />
                {section.label}
              </button>
            ))}
          </div>
        </div>
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
