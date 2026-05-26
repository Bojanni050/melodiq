"use client";

export default function CreateWorkspaceDialog({
  open,
  value,
  onChange,
  onSubmit,
  onCancel,
  onKeyDown,
}: {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onSubmit}
        className="rounded-md bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:text-white/90"
      >
        + Create Workspace
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Workspace name"
        className="h-8 rounded-md border border-white/15 bg-white/5 px-2.5 text-xs text-white placeholder:text-white/30"
        aria-label="Workspace name"
      />
      <button
        type="button"
        onClick={onSubmit}
        className="h-8 rounded-md bg-primary-500/80 px-3 text-xs text-white hover:bg-primary-500"
      >
        Add
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="h-8 rounded-md bg-white/5 px-3 text-xs text-white/60 hover:text-white/80"
      >
        Cancel
      </button>
    </div>
  );
}
