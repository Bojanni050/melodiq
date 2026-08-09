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
interface SelectionState {
  selectedIds: Set<string>;
  selectionAnchorId: string | null;
  toggleSelection: (trackId: string, displayedIds: string[], options?: { mode?: "toggle" | "range" }) => void;
  toggleSelectAll: (displayedIds: string[]) => void;
  setSelectedIds: (ids: Set<string>) => void;
  clearSelection: () => void;
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
        anchorId = trackId;
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
  setCollapsed: (v: boolean) => void;
  setIsQHD: (v: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()((set) => ({
  collapsed: false,
  isQHD: false,
  setCollapsed: (v) => set({ collapsed: v }),
  setIsQHD: (v) => set({ isQHD: v, collapsed: !v }),
}));
