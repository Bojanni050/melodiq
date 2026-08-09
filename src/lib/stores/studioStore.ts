import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "./debouncedStorage";

export interface SavedLyric {
  id: string;
  title: string;
  lyrics: string;
  savedAt: string;
}

interface StudioState {
  songIdea: string;
  lyrics: string;
  lyricsContext: string;
  title: string;
  autoCreateWorkspaceFromGeneratedTitle: boolean;
  selectedProviders: Record<string, string>;
  rememberProviderChoice: boolean;
  language: string;
  customLanguage: string;
  instrumental: boolean;
  vocalGender: "female" | "male" | "auto";
  structure: string;
  customStructure: string;
  weirdness: number;
  styleInfluence: number;
  audioWeight: number;
  negativeTags: string;
  usePersonaVoice: boolean;
  savedLyrics: SavedLyric[];
  savedLyricsLoaded: boolean;
  setSongIdea: (idea: string) => void;
  setLyrics: (lyrics: string) => void;
  setLyricsContext: (context: string) => void;
  setTitle: (title: string) => void;
  setAutoCreateWorkspaceFromGeneratedTitle: (enabled: boolean) => void;
  setProvider: (key: string, model: string) => void;
  toggleProvider: (key: string, defaultModel: string) => void;
  setProviderModel: (key: string, model: string) => void;
  setRememberProviderChoice: (val: boolean) => void;
  setLanguage: (lang: string) => void;
  setCustomLanguage: (lang: string) => void;
  setInstrumental: (val: boolean) => void;
  setVocalGender: (val: "female" | "male" | "auto") => void;
  setStructure: (val: string) => void;
  setCustomStructure: (val: string) => void;
  setWeirdness: (val: number) => void;
  setStyleInfluence: (val: number) => void;
  setAudioWeight: (val: number) => void;
  setNegativeTags: (val: string) => void;
  setUsePersonaVoice: (val: boolean) => void;
  fetchSavedLyrics: () => Promise<void>;
  saveLyric: () => Promise<SavedLyric | null>;
  loadSavedLyric: (id: string) => void;
  deleteSavedLyric: (id: string) => Promise<void>;
  reset: () => void;
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      songIdea: "",
      lyrics: "",
      lyricsContext: "",
      title: "",
      autoCreateWorkspaceFromGeneratedTitle: false,
      selectedProviders: { apimart: "v5.5" },
      rememberProviderChoice: true,
      language: "English",
      customLanguage: "",
      instrumental: false,
      vocalGender: "auto",
      structure: "pop-default",
      customStructure: "",
      weirdness: 50,
      styleInfluence: 50,
      audioWeight: 50,
      negativeTags: "",
      usePersonaVoice: false,
      savedLyrics: [],
      savedLyricsLoaded: false,
      setSongIdea: (idea) => set({ songIdea: idea }),
      setLyrics: (lyrics) => set({ lyrics }),
      setLyricsContext: (context) => set({ lyricsContext: context }),
      setTitle: (title) => set({ title }),
      setAutoCreateWorkspaceFromGeneratedTitle: (enabled) =>
        set({ autoCreateWorkspaceFromGeneratedTitle: enabled }),
      setProvider: (key, model) => set({ selectedProviders: { [key]: model } }),
      toggleProvider: (key, defaultModel) =>
        set((state) => {
          const next = { ...state.selectedProviders };
          if (next[key]) {
            delete next[key];
          } else {
            next[key] = defaultModel;
          }
          return { selectedProviders: next };
        }),
      setProviderModel: (key, model) =>
        set((state) => ({
          selectedProviders: { ...state.selectedProviders, [key]: model },
        })),
      setRememberProviderChoice: (val) => set({ rememberProviderChoice: val }),
      setLanguage: (lang) => set({ language: lang }),
      setCustomLanguage: (lang) => set({ customLanguage: lang }),
      setInstrumental: (val) => set({ instrumental: val }),
      setVocalGender: (val) => set({ vocalGender: val }),
      setStructure: (val) => set({ structure: val }),
      setCustomStructure: (val) => set({ customStructure: val }),
      setWeirdness: (val) => set({ weirdness: val }),
      setStyleInfluence: (val) => set({ styleInfluence: val }),
      setAudioWeight: (val) => set({ audioWeight: val }),
      setNegativeTags: (val) => set({ negativeTags: val }),
      setUsePersonaVoice: (val) => set({ usePersonaVoice: val }),
      fetchSavedLyrics: async () => {
        if (typeof window === "undefined") return;
        try {
          const res = await fetch("/api/saved-lyrics");
          if (!res.ok) return;
          const data = await res.json();
          set({ savedLyrics: data.savedLyrics ?? [], savedLyricsLoaded: true });
        } catch {}
      },
      saveLyric: async () => {
        const state = get();
        const title = state.title.trim() || state.lyrics.trim().split("\n")[0].slice(0, 60) || "Untitled";
        try {
          const res = await fetch("/api/saved-lyrics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, lyrics: state.lyrics }),
          });
          if (!res.ok) return null;
          const data = await res.json();
          const entry: SavedLyric = data.savedLyric;
          set((s) => ({ savedLyrics: [entry, ...s.savedLyrics] }));
          return entry;
        } catch {
          return null;
        }
      },
      loadSavedLyric: (id) =>
        set((state) => {
          const entry = state.savedLyrics.find((s) => s.id === id);
          if (!entry) return state;
          return { lyrics: entry.lyrics, title: entry.title };
        }),
      deleteSavedLyric: async (id) => {
        set((state) => ({ savedLyrics: state.savedLyrics.filter((s) => s.id !== id) }));
        try {
          await fetch(`/api/saved-lyrics/${id}`, { method: "DELETE" });
        } catch {}
      },
      reset: () =>
        set({
          songIdea: "",
          lyrics: "",
          lyricsContext: "",
          title: "",
          autoCreateWorkspaceFromGeneratedTitle: false,
          selectedProviders: { apimart: "v5.5" },
          language: "English",
          customLanguage: "",
          instrumental: false,
          vocalGender: "auto",
          structure: "pop-default",
          customStructure: "",
          weirdness: 50,
          styleInfluence: 50,
          audioWeight: 50,
          negativeTags: "",
          usePersonaVoice: false,
        }),
    }),
    {
      name: "melodiq-studio",
      storage: createDebouncedStorage(500),
      skipHydration: true,
      partialize: (state) => {
        const { savedLyrics: _sl, savedLyricsLoaded: _sll, ...rest } = state as any;
        return rest;
      },
      merge: (persistedState: any, currentState) => {
        const merged = { ...currentState, ...persistedState };
        if (!merged.selectedProviders) {
          merged.selectedProviders = merged.provider
            ? { [merged.provider]: merged.providerModel || "v5.5" }
            : { apimart: "v5.5" };
        }
        // "Remember choice" unchecked — don't restore the last-used provider,
        // fall back to the form's default instead of the persisted value.
        if (persistedState?.rememberProviderChoice === false) {
          merged.selectedProviders = currentState.selectedProviders;
        }
        return merged;
      },
    }
  )
);
