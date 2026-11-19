import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "./debouncedStorage";
import { MAX_INSPIRATION_TRACKS, type InspirationTrack } from "@/lib/inspiration";
import type { DnaStrength } from "@/lib/dna/context";
import type { HabitOrigin, HabitSnapshot } from "@/lib/dna/habits";

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
  artistName: string;
  writerName: string;
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
  // APIMart Suno V6 options
  apimartVariety: "off" | "normal" | "high" | "extra" | "max";
  apimartMaxMode: boolean;
  apimartAudioFormat: "mp3" | "m4a" | "wav";
  // PoYo Suno V6 options — PoYo's API only exposes variety for the V6 family,
  // no max-mode or output-format equivalent (unlike APIMart).
  poyoVariety: "off" | "normal" | "high" | "extra" | "max";
  /**
   * How much of the user's Melody DNA is appended to the style prompt.
   * Off by default: a generation should never inherit DNA without the user
   * asking for it. The page's switch turns it on for the next generations.
   */
  dnaInfluence: DnaStrength;
  // Inspiration references for APIMart v6 inspo generation (display only —
  // lyrics/style are never copied from these tracks). inspirationEnabled lets
  // the user park tracks here but generate normally.
  inspiration: InspirationTrack[];
  inspirationEnabled: boolean;
  /** 0–100 (%). Mapped to APIMart inspo `audio_weight` 0.00–1.00. Default 20. */
  inspoAudioWeight: number;
  savedLyrics: SavedLyric[];
  savedLyricsLoaded: boolean;
  /**
   * How the current prompt came to be, for the Habits block of Melody DNA.
   * Session state, never persisted: a reload starts a new generation from
   * scratch, and an old "preset" flag would mislabel the next blank prompt.
   */
  habitOrigin: HabitOrigin;
  /** True once an advanced control was touched beyond prompt and lyrics. */
  habitAdvanced: boolean;
  /** True once the prompt, lyrics or optimization changed before generating. */
  habitEdited: boolean;
  markStart: (origin: HabitOrigin) => void;
  markAdvanced: () => void;
  markEdited: () => void;
  /** Preset load: the prompt comes from the library, not from typing. */
  applyPresetPrompt: (prompt: string) => void;
  /** Reads the pending habit and resets it, so one generation logs one event. */
  consumeHabit: () => HabitSnapshot;
  setSongIdea: (idea: string) => void;
  setLyrics: (lyrics: string) => void;
  setLyricsContext: (context: string) => void;
  setTitle: (title: string) => void;
  setArtistName: (name: string) => void;
  setWriterName: (name: string) => void;
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
  setApimartVariety: (val: "off" | "normal" | "high" | "extra" | "max") => void;
  setApimartMaxMode: (val: boolean) => void;
  setApimartAudioFormat: (val: "mp3" | "m4a" | "wav") => void;
  setPoyoVariety: (val: "off" | "normal" | "high" | "extra" | "max") => void;
  setDnaInfluence: (val: DnaStrength) => void;
  addInspirationTrack: (track: InspirationTrack) => boolean;
  removeInspirationTrack: (id: string) => void;
  clearInspiration: () => void;
  setInspirationEnabled: (enabled: boolean) => void;
  setInspoAudioWeight: (val: number) => void;
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
      artistName: "",
      writerName: "",
      autoCreateWorkspaceFromGeneratedTitle: true,
      selectedProviders: { apimart: "v6" },
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
      apimartVariety: "off",
      apimartMaxMode: false,
      apimartAudioFormat: "mp3",
      poyoVariety: "off",
      dnaInfluence: "off",
      inspiration: [],
      inspirationEnabled: true,
      inspoAudioWeight: 20,
      savedLyrics: [],
      savedLyricsLoaded: false,
      habitOrigin: "scratch",
      habitAdvanced: false,
      habitEdited: false,
      markStart: (origin) => set({ habitOrigin: origin }),
      markAdvanced: () => set({ habitAdvanced: true }),
      markEdited: () => set({ habitEdited: true }),
      applyPresetPrompt: (prompt) => set({ songIdea: prompt, habitOrigin: "preset" }),
      consumeHabit: () => {
        const { habitOrigin, habitAdvanced, habitEdited } = get();
        set({ habitOrigin: "scratch", habitAdvanced: false, habitEdited: false });
        return {
          origin: habitOrigin,
          mode: habitAdvanced ? "advanced" : "simple",
          edited: habitEdited,
        };
      },
      setSongIdea: (idea) => set({ songIdea: idea }),
      setLyrics: (lyrics) => set({ lyrics }),
      setLyricsContext: (context) => set({ lyricsContext: context }),
      setTitle: (title) => set({ title }),
      setArtistName: (name) => set({ artistName: name }),
      setWriterName: (name) => set({ writerName: name }),
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
      // Vocal gender and instrumental change the request itself (who sings,
      // whether there are lyrics), not how finely it is tuned. Counting them as
      // "advanced" would label nearly every instrumental generation advanced and
      // would trip on Reuse Prompt restoring a gender automatically.
      setVocalGender: (val) => set({ vocalGender: val }),
      setStructure: (val) => set({ structure: val }),
      setCustomStructure: (val) => set({ customStructure: val }),
      setWeirdness: (val) => set({ weirdness: val, habitAdvanced: true }),
      setStyleInfluence: (val) => set({ styleInfluence: val, habitAdvanced: true }),
      setAudioWeight: (val) => set({ audioWeight: val, habitAdvanced: true }),
      setNegativeTags: (val) => set({ negativeTags: val, habitAdvanced: true }),
      setUsePersonaVoice: (val) => set({ usePersonaVoice: val, habitAdvanced: true }),
      setApimartVariety: (val) => set({ apimartVariety: val, habitAdvanced: true }),
      setApimartMaxMode: (val) => set({ apimartMaxMode: val, habitAdvanced: true }),
      setApimartAudioFormat: (val) => set({ apimartAudioFormat: val, habitAdvanced: true }),
      setPoyoVariety: (val) => set({ poyoVariety: val, habitAdvanced: true }),
      setDnaInfluence: (val) => set({ dnaInfluence: val, habitAdvanced: true }),
      addInspirationTrack: (track) => {
        const current = get().inspiration;
        if (current.some((t) => t.id === track.id)) return true;
        if (current.length >= MAX_INSPIRATION_TRACKS) return false;
        // Dropping a new reference means the user wants inspo again.
        set({ inspiration: [...current, track], inspirationEnabled: true, habitAdvanced: true });
        return true;
      },
      removeInspirationTrack: (id) =>
        set((state) => ({ inspiration: state.inspiration.filter((t) => t.id !== id) })),
      clearInspiration: () => set({ inspiration: [] }),
      setInspirationEnabled: (enabled) => set({ inspirationEnabled: enabled, habitAdvanced: true }),
      setInspoAudioWeight: (val) =>
        set({ inspoAudioWeight: Math.min(100, Math.max(0, Math.round(val))), habitAdvanced: true }),
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
          // Loading a kept lyric is a start, not an edit: the text is the
          // user's own work, chosen rather than typed into this session.
          return { lyrics: entry.lyrics, title: entry.title, habitOrigin: "saved_lyrics" };
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
          artistName: "",
          writerName: "",
          autoCreateWorkspaceFromGeneratedTitle: true,
          selectedProviders: { apimart: "v6" },
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
          apimartVariety: "off",
          apimartMaxMode: false,
          apimartAudioFormat: "mp3",
          poyoVariety: "off",
          dnaInfluence: "off",
          inspiration: [],
      inspirationEnabled: true,
          inspoAudioWeight: 20,
          habitOrigin: "scratch",
          habitAdvanced: false,
          habitEdited: false,
        }),
    }),
    {
      name: "melodiq-studio",
      storage: createDebouncedStorage(500),
      skipHydration: true,
      // v1: auto-create a workspace from the generated title is on by default now;
      // older persisted states (which stored the old default `false`) are migrated.
      // v2: Melody DNA defaults to off. A persisted "subtle" is the old default,
      // not a deliberate choice — it cannot be told apart from one — so it is
      // turned off once here. A stored "strong" was always an explicit choice
      // and stays.
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (!persistedState || typeof persistedState !== "object") {
          return persistedState as any;
        }
        const next = { ...persistedState, autoCreateWorkspaceFromGeneratedTitle: true };
        if (version < 2 && next.dnaInfluence === "subtle") next.dnaInfluence = "off";
        return next;
      },
      partialize: (state) => {
        const {
          savedLyrics: _sl,
          savedLyricsLoaded: _sll,
          habitOrigin: _ho,
          habitAdvanced: _ha,
          habitEdited: _he,
          ...rest
        } = state as any;
        return rest;
      },
      merge: (persistedState: any, currentState) => {
        const merged = { ...currentState, ...persistedState };
        if (!merged.selectedProviders) {
          merged.selectedProviders = merged.provider
            ? { [merged.provider]: merged.providerModel || "v5.5" }
            : { apimart: "v6" };
        }
        // "Remember choice" unchecked — don't restore the last-used provider,
        // fall back to the form's default instead of the persisted value.
        if (persistedState?.rememberProviderChoice === false) {
          merged.selectedProviders = currentState.selectedProviders;
        }
        // Ensure V6 defaults are present for existing persisted states
        if (merged.apimartVariety === undefined) merged.apimartVariety = "off";
        if (merged.apimartMaxMode === undefined) merged.apimartMaxMode = false;
        if (merged.apimartAudioFormat === undefined) merged.apimartAudioFormat = "mp3";
        if (merged.poyoVariety === undefined) merged.poyoVariety = "off";
        // A state from before Melody DNA existed has no strength at all; without
        // this the switch renders with nothing selected and the value travels as
        // an unknown string.
        if (
          merged.dnaInfluence !== "off" &&
          merged.dnaInfluence !== "subtle" &&
          merged.dnaInfluence !== "strong"
        ) {
          merged.dnaInfluence = "off";
        }
        if (!Array.isArray(merged.inspiration)) merged.inspiration = [];
        if (typeof merged.inspirationEnabled !== "boolean") merged.inspirationEnabled = true;
        if (typeof merged.inspoAudioWeight !== "number" || Number.isNaN(merged.inspoAudioWeight)) merged.inspoAudioWeight = 20;
        return merged;
      },
    }
  )
);
