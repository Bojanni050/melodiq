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

export const usePlayerStore = create<PlayerState>()((set) => ({
  currentTrack: null,
  isPlaying: false,
  volume: 0.8,
  progress: 0,
  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => set({ volume }),
  setProgress: (progress) => set({ progress }),
}));

interface StudioState {
  songIdea: string;
  lyrics: string;
  title: string;
  provider: string;
  providerModel: string;
  language: string;
  instrumental: boolean;
  customLanguage: string;
  vocalGender: "female" | "male" | "auto";
  setSongIdea: (idea: string) => void;
  setLyrics: (lyrics: string) => void;
  setTitle: (title: string) => void;
  setProvider: (provider: string) => void;
  setProviderModel: (model: string) => void;
  setLanguage: (lang: string) => void;
  setCustomLanguage: (lang: string) => void;
  setInstrumental: (val: boolean) => void;
  setVocalGender: (val: "female" | "male" | "auto") => void;
  reset: () => void;
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set) => ({
      songIdea: "",
      lyrics: "",
      title: "",
      provider: "lyria",
      providerModel: "lyria-3",
      language: "English",
      customLanguage: "",
      instrumental: false,
      vocalGender: "auto",
      setSongIdea: (idea) => set({ songIdea: idea }),
      setLyrics: (lyrics) => set({ lyrics }),
      setTitle: (title) => set({ title }),
      setProvider: (provider) => set({ provider }),
      setProviderModel: (model) => set({ providerModel: model }),
      setLanguage: (lang) => set({ language: lang }),
      setCustomLanguage: (lang) => set({ customLanguage: lang }),
      setInstrumental: (val) => set({ instrumental: val }),
      setVocalGender: (val) => set({ vocalGender: val }),
      reset: () =>
        set({
          songIdea: "",
          lyrics: "",
          title: "",
          provider: "lyria",
          providerModel: "lyria-3",
          language: "English",
          customLanguage: "",
          instrumental: false,
          vocalGender: "auto",
        }),
    }),
    { name: "sonara-studio" }
  )
);
