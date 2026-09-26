import { create } from "zustand";
import { persist } from "zustand/middleware";

// UI Store — active tab and selected track
interface UIState {
  activeTab: "create" | "library";
  selectedTrackId: string | null;
  setActiveTab: (tab: "create" | "library") => void;
  setSelectedTrackId: (id: string | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeTab: "create",
      selectedTrackId: null,
      setActiveTab: (tab) => set({ activeTab: tab }),
      setSelectedTrackId: (id) => set({ selectedTrackId: id }),
    }),
    {
      name: "melodiq-ui",
      partialize: (state) => ({ activeTab: state.activeTab }),
    }
  )
);

// High-Performance Track Selection Store (O(1) Localized Updates)

// How a click modifies the selection. `toggle` is a plain click, `range` is a
// Shift-click that selects everything between the anchor and the clicked row,
// and `additive` is a Ctrl/Cmd-click that adds or removes a single row without
// moving the anchor — so a later Shift-click still spans from the original
// anchor. That is the behaviour users expect from file managers.
export type SelectionMode = "toggle" | "range" | "additive";

interface SelectionState {
  selectedIds: Set<string>;
  selectionAnchorId: string | null;
  toggleSelection: (trackId: string, displayedIds: string[], options?: { mode?: SelectionMode }) => void;
  toggleSelectAll: (displayedIds: string[]) => void;
  setSelectedIds: (ids: Set<string>) => void;
  clearSelection: () => void;
}

// Derives the selection mode from a mouse event's modifier keys. Centralised
// so every track list (Library, Playlists, Workspaces, Releases, Archive, Slim
// Archief) interprets Ctrl vs Shift identically instead of each list rolling its
// own `e.shiftKey` check.
export function selectionModeFromEvent(event: {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}): SelectionMode {
  if (event.shiftKey) return "range";
  if (event.ctrlKey || event.metaKey) return "additive";
  return "toggle";
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedIds: new Set<string>(),
  selectionAnchorId: null,
  toggleSelection: (trackId, displayedIds, options) => {
    set((state) => {
      const mode = options?.mode ?? "toggle";
      const next = new Set(state.selectedIds);
      let anchorId = state.selectionAnchorId;

      if (mode === "range") {
        const anchorIndex = anchorId ? displayedIds.indexOf(anchorId) : -1;
        const targetIndex = displayedIds.indexOf(trackId);

        if (targetIndex >= 0) {
          if (anchorIndex < 0) {
            next.add(trackId);
          } else {
            const start = Math.min(anchorIndex, targetIndex);
            const end = Math.max(anchorIndex, targetIndex);
            displayedIds.slice(start, end + 1).forEach((id) => next.add(id));
          }
        }
        anchorId = trackId;
      } else {
        if (next.has(trackId)) {
          next.delete(trackId);
        } else {
          next.add(trackId);
        }
        // An additive click deliberately leaves the anchor alone so that
        // Ctrl-click a few rows, then Shift-click, still spans the original
        // range instead of collapsing to a single row.
        if (mode === "toggle") {
          anchorId = trackId;
        }
      }

      return { selectedIds: next, selectionAnchorId: anchorId };
    });
  },
  toggleSelectAll: (displayedIds) => {
    set((state) => {
      const hasAllVisible = displayedIds.length > 0 && displayedIds.every((id) => state.selectedIds.has(id));
      const next = new Set(state.selectedIds);
      if (hasAllVisible) {
        displayedIds.forEach((id) => next.delete(id));
      } else {
        displayedIds.forEach((id) => next.add(id));
      }
      return { selectedIds: next };
    });
  },
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: new Set<string>(), selectionAnchorId: null }),
}));

// Saved Style & Prompt Presets Store
export interface SavedPreset {
  id: string;
  name: string;
  prompt: string;
  notes: string;
  createdAt: string;
}

interface PresetsState {
  presets: SavedPreset[];
  presetsLoaded: boolean;
  fetchPresets: () => Promise<void>;
  addPreset: (name: string, prompt: string, notes: string) => Promise<SavedPreset | null>;
  deletePreset: (id: string) => Promise<void>;
}

export const usePresetsStore = create<PresetsState>()((set) => ({
  presets: [],
  presetsLoaded: false,
  fetchPresets: async () => {
    if (typeof window === "undefined") return;
    try {
      const res = await fetch("/api/style-presets");
      if (!res.ok) return;
      const data = await res.json();
      set({ presets: data.presets ?? [], presetsLoaded: true });
    } catch {}
  },
  addPreset: async (name, prompt, notes) => {
    try {
      const res = await fetch("/api/style-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, prompt, notes }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const preset: SavedPreset = data.preset;
      set((state) => ({ presets: [...state.presets, preset] }));
      return preset;
    } catch {
      return null;
    }
  },
  deletePreset: async (id) => {
    set((state) => ({ presets: state.presets.filter((p) => p.id !== id) }));
    try {
      await fetch(`/api/style-presets/${id}`, { method: "DELETE" });
    } catch {}
  },
}));

// Badges tracks that are linked from the Song Archive: "original" (the
// definitive source-of-truth lyrics+prompt) vs. "translation". Fetched once
// and shared across every TrackCard instead of one request per card.
type ArchiveLinkKind = "original" | "translation";

interface ArchiveLinksState {
  links: Record<string, ArchiveLinkKind>;
  loaded: boolean;
  loading: boolean;
  load: () => Promise<void>;
  setLink: (trackId: string, kind: ArchiveLinkKind) => void;
}

export const useArchiveLinksStore = create<ArchiveLinksState>()((set, get) => ({
  links: {},
  loaded: false,
  loading: false,
  setLink: (trackId, kind) => set((state) => ({ links: { ...state.links, [trackId]: kind } })),
  load: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const res = await fetch("/api/archive/track-links");
      if (!res.ok) {
        set({ loading: false, loaded: true });
        return;
      }
      const data = await res.json();
      set({ links: data.links ?? {}, loaded: true, loading: false });
    } catch {
      set({ loading: false, loaded: true });
    }
  },
}));

// Sidebar Store
interface SidebarState {
  collapsed: boolean;
  isQHD: boolean;
  // True once the viewport is >= the `lg` breakpoint (1024px), i.e. once the
  // fixed desktop <aside> in Sidebar.tsx is actually rendered (`hidden lg:flex`).
  // Pages use this to zero out their sidebar-offset margin below that
  // breakpoint instead of always reserving 240/300px of space that no visible
  // sidebar occupies.
  isDesktop: boolean;
  setCollapsed: (v: boolean) => void;
  setIsQHD: (v: boolean) => void;
  setIsDesktop: (v: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()((set) => ({
  collapsed: false,
  isQHD: false,
  isDesktop: false,
  setCollapsed: (v) => set({ collapsed: v }),
  setIsQHD: (v) => set({ isQHD: v }),
  setIsDesktop: (v) => set({ isDesktop: v }),
}));
