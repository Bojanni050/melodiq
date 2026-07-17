"use client";

export default function UnsavedChangesBar({
  count,
  saving,
  error,
  onSave,
  onDiscard,
}: {
  count: number;
  saving: boolean;
  error?: string | null;
  onSave: () => void;
  onDiscard: () => void;
}) {
  if (count === 0) return null;

  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-4 border-t border-white/10 bg-[#12121a]/95 backdrop-blur-sm px-4 py-3">
      <div className="flex items-center justify-between gap-3 max-w-3xl">
        <p className="text-xs text-white/60">
          {count} unsaved change{count === 1 ? "" : "s"}
          {error && <span className="text-red-400 ml-2">{error}</span>}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            Discard
          </button>
          <button type="button" onClick={onSave} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
