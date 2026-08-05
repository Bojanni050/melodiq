"use client";

import { useUserStore } from "@/lib/store";

export default function RoleSwitcher() {
  const user = useUserStore((s) => s.user);
  const viewAsRole = useUserStore((s) => s.viewAsRole);
  const setViewAsRole = useUserStore((s) => s.setViewAsRole);

  if (!user || user.role !== "admin") return null;

  if (viewAsRole === "listener") {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-semibold text-black shadow-lg">
        <span>👁 Viewing as listener (Pieter)</span>
        <button
          type="button"
          onClick={() => setViewAsRole(null)}
          className="rounded-md bg-black/20 px-3 py-1 text-xs font-bold text-white transition hover:bg-black/40"
        >
          ← Back to Admin
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setViewAsRole("listener")}
      className="fixed bottom-20 right-4 z-50 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-200 backdrop-blur-sm transition hover:bg-amber-500/20"
      title="Preview the app as a listener (Pieter)"
    >
      👁 View as listener
    </button>
  );
}
