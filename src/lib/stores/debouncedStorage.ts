import { type PersistStorage, type StorageValue } from "zustand/middleware";

export function createDebouncedStorage<T>(delayMs: number): PersistStorage<T> {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return {
    getItem: (name) => {
      if (typeof window === "undefined") return null;
      try {
        const str = localStorage.getItem(name);
        if (!str) return null;
        return JSON.parse(str) as StorageValue<T>;
      } catch (e) {
        console.warn(`[PersistStorage] Failed to read ${name} from localStorage:`, e);
        return null;
      }
    },
    setItem: (name, value) => {
      if (typeof window === "undefined") return;
      const existing = timers.get(name);
      if (existing) clearTimeout(existing);
      timers.set(
        name,
        setTimeout(() => {
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch (e) {
            console.error(`[PersistStorage] Failed to save ${name} to localStorage:`, e);
          }
          timers.delete(name);
        }, delayMs)
      );
    },
    removeItem: (name) => {
      if (typeof window === "undefined") return;
      const existing = timers.get(name);
      if (existing) clearTimeout(existing);
      timers.delete(name);
      try {
        localStorage.removeItem(name);
      } catch (e) {
        console.warn(`[PersistStorage] Failed to remove ${name} from localStorage:`, e);
      }
    },
  };
}
