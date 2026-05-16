import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Track {
  id: string;
  title: string | null;
  provider: string;
  providerModel: string;
  prompt: string;
  status: "pending" | "generating" | "done" | "failed";
  audioUrl: string | null;
  audioUrlHd: string | null;
  s3Key: string | null;
  s3KeyHd: string | null;
  duration: number | null;
  lyrics: string | null;
  createdAt: string;
  error: string | null;
}

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  progress: number;
  setCurrentTrack: (track: Track | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setProgress: (progress: number) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      currentTrack: null,
      isPlaying: false,
      volume: 0.8,
      progress: 0,
      setCurrentTrack: (track) => set({ currentTrack: track }),
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setVolume: (volume) => set({ volume }),
      setProgress: (progress) => set({ progress }),
    }),
    {
      name: "sonara-player",
      partialize: (state) => ({ volume: state.volume }),
    }
  )
);

interface StudioState {
  songIdea: string;
  lyrics: string;
  lyricsContext: string;
  title: string;
  provider: string;
  providerModel: string;
  language: string;
  customLanguage: string;
  instrumental: boolean;
  vocalGender: "female" | "male" | "auto";
  structure: string;
  customStructure: string;
  setSongIdea: (idea: string) => void;
  setLyrics: (lyrics: string) => void;
  setLyricsContext: (context: string) => void;
  setTitle: (title: string) => void;
  setProvider: (provider: string) => void;
  setProviderModel: (model: string) => void;
  setLanguage: (lang: string) => void;
  setCustomLanguage: (lang: string) => void;
  setInstrumental: (val: boolean) => void;
  setVocalGender: (val: "female" | "male" | "auto") => void;
  setStructure: (val: string) => void;
  setCustomStructure: (val: string) => void;
  reset: () => void;
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set) => ({
      songIdea: "",
      lyrics: "",
      lyricsContext: "",
      title: "",
      provider: "lyria",
      providerModel: "lyria-3",
      language: "English",
      customLanguage: "",
      instrumental: false,
      vocalGender: "auto",
      structure: "",
      customStructure: "",
      setSongIdea: (idea) => set({ songIdea: idea }),
      setLyrics: (lyrics) => set({ lyrics }),
      setLyricsContext: (context) => set({ lyricsContext: context }),
      setTitle: (title) => set({ title }),
      setProvider: (provider) => set({ provider }),
      setProviderModel: (model) => set({ providerModel: model }),
      setLanguage: (lang) => set({ language: lang }),
      setCustomLanguage: (lang) => set({ customLanguage: lang }),
      setInstrumental: (val) => set({ instrumental: val }),
      setVocalGender: (val) => set({ vocalGender: val }),
      setStructure: (val) => set({ structure: val }),
      setCustomStructure: (val) => set({ customStructure: val }),
      reset: () =>
        set({
          songIdea: "",
          lyrics: "",
          lyricsContext: "",
          title: "",
          provider: "lyria",
          providerModel: "lyria-3",
          language: "English",
          customLanguage: "",
          instrumental: false,
          vocalGender: "auto",
          structure: "",
          customStructure: "",
        }),
    }),
    { name: "sonara-studio", skipHydration: true }
  )
);

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
      name: "sonara-ui",
      partialize: (state) => ({ activeTab: state.activeTab }),
    }
  )
);
