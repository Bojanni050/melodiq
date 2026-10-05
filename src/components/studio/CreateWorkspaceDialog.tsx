"use client";

import { useT } from "@/hooks/useT";

export default function CreateWorkspaceDialog({
  open,
  value,
  onOpen,
  onChange,
  onSubmit,
  onCancel,
  onKeyDown,
}: {
  open: boolean;
  value: string;
  onOpen: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const t = useT();
  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className=" bg-white/5 px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
      >
        {t("studio.createWorkspace")}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t("studio.workspaceNamePlaceholder")}
        className="h-8  border border-line-strong bg-white/5 px-2.5 text-sm text-ink placeholder:text-ink-dim"
        aria-label={t("studio.workspaceNamePlaceholder")}
      />
      <button
        type="button"
        onClick={onSubmit}
        className="h-8  bg-accent/80 px-3 text-sm text-ink hover:bg-accent"
      >
        {t("releases.add")}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="h-8  bg-white/5 px-3 text-sm text-ink-muted hover:text-ink-muted"
      >
        {t("common.cancel")}
      </button>
    </div>
  );
}
