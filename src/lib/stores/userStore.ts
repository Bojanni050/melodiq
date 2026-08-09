import { create } from "zustand";

export type UserRole = "user" | "admin" | "listener";

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  artistAlias: string | null;
  composerAlias: string | null;
  writerAlias: string | null;
  role: UserRole;
  createdAt: string;
}

interface UserState {
  user: UserProfile | null;
  loading: boolean;
  setUser: (user: UserProfile | null) => void;
  loadUser: () => Promise<UserProfile | null>;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  loading: false,
  setUser: (user) => set({ user }),
  loadUser: async () => {
    if (get().loading) return get().user;
    if (get().user) return get().user;
    set({ loading: true });
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        set({ user: null, loading: false });
        return null;
      }
      const data = (await res.json()) as { user?: UserProfile };
      const user = data.user ?? null;
      if (user && !user.role) user.role = "user";
      set({ user, loading: false });
      return user;
    } catch {
      set({ user: null, loading: false });
      return null;
    }
  },
}));
