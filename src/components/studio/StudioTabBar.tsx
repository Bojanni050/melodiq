import clsx from "clsx";

const SEGMENTED_BUTTON_BASE = "rounded-md px-3 py-1.5 text-xs font-medium transition";
const SEGMENTED_BUTTON_ACTIVE = "bg-primary-500 text-white";
const SEGMENTED_BUTTON_INACTIVE = "text-white/65 hover:bg-white/10 hover:text-white";

interface StudioTabBarProps {
  activeTab: "workspaces" | "recent";
  onTabChange: (tab: "workspaces" | "recent") => void;
}

export default function StudioTabBar({ activeTab, onTabChange }: StudioTabBarProps) {
  return (
    <div className="flex items-center gap-1 mb-3 rounded-lg border border-white/10 bg-white/5 p-1 w-fit">
      <button
        type="button"
        onClick={() => onTabChange("workspaces")}
        className={clsx(
          SEGMENTED_BUTTON_BASE,
          activeTab === "workspaces" ? SEGMENTED_BUTTON_ACTIVE : SEGMENTED_BUTTON_INACTIVE
        )}
      >
        Workspaces
      </button>
      <button
        type="button"
        onClick={() => onTabChange("recent")}
        className={clsx(
          SEGMENTED_BUTTON_BASE,
          activeTab === "recent" ? SEGMENTED_BUTTON_ACTIVE : SEGMENTED_BUTTON_INACTIVE
        )}
      >
        Recent Tracks
      </button>
    </div>
  );
}
