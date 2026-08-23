import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Locale = "en" | "nl";

export const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "nl", label: "Nederlands" },
];

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

// Source of truth for a logged-in user is users.language (synced in from the
// account profile once it loads — see Sidebar.tsx); this local persistence
// is just the pre-login/anonymous fallback so the UI doesn't flash back to
// English between page loads.
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "en",
      setLocale: (locale) => set({ locale }),
    }),
    { name: "melodiq-locale" }
  )
);
