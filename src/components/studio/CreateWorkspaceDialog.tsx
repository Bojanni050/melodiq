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
        className="rounded-md bg-white/5 px-3 py-1.5 text-sm text-white/70 hover:text-white/90"
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
        className="h-8 rounded-md border border-white/15 bg-white/5 px-2.5 text-sm text-white placeholder:text-white/30"
        aria-label={t("studio.workspaceNamePlaceholder")}
      />
      <button
        type="button"
        onClick={onSubmit}
        className="h-8 rounded-md bg-primary-500/80 px-3 text-sm text-white hover:bg-primary-500"
      >
        {t("releases.add")}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="h-8 rounded-md bg-white/5 px-3 text-sm text-white/60 hover:text-white/80"
      >
        {t("common.cancel")}
      </button>
    </div>
  );
}
