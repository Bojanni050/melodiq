/**
 * store.ts — Re-export barrel
 *
 * All stores have been split into individual files under src/lib/stores/.
 * This file re-exports everything so that existing imports from "@/lib/store"
 * continue to work without any changes across the rest of the codebase.
 */

export type { Track } from "./stores/playerStore";
export { usePlayerStore } from "./stores/playerStore";

export type { UserRole, UserProfile } from "./stores/userStore";
export { useUserStore } from "./stores/userStore";

export type { Playlist } from "./stores/playlistStore";
export { usePlaylistStore } from "./stores/playlistStore";

export type { ReleaseTrack, Release } from "./stores/releaseStore";
export { useReleaseStore } from "./stores/releaseStore";

export type { Workspace } from "./stores/workspaceStore";
export {
  useWorkspaceStore,
  DEFAULT_WORKSPACE_ID,
  DEFAULT_WORKSPACE_NAME,
  WORKSPACE_FOLDER_GRADIENTS,
} from "./stores/workspaceStore";

export type { SavedLyric } from "./stores/studioStore";
export { useStudioStore } from "./stores/studioStore";

export type { SavedPreset } from "./stores/uiStores";
export {
  useUIStore,
  useSelectionStore,
  usePresetsStore,
  useArchiveLinksStore,
  useSidebarStore,
} from "./stores/uiStores";

export type { Locale } from "./stores/localeStore";
export { useLocaleStore, LOCALES } from "./stores/localeStore";
