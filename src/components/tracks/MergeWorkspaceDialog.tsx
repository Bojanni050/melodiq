"use client";

interface MergeWorkspaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
  onConfirm: () => void;
}

export default function MergeWorkspaceDialog({
  isOpen,
  onClose,
  workspaceName,
  onConfirm,
}: MergeWorkspaceDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-surface border border-line  shadow-2xl p-6 w-[440px] max-w-[90vw] flex flex-col gap-4">
        <h3 className="text-base font-semibold text-ink">Workspace name bestaat al</h3>
        <p className="text-sm text-ink/65">
          Er bestaat al een workspace met deze naam: <span className="text-ink">{workspaceName}</span>.
          Wil je de track(s) daaraan toevoegen en de workspaces samenvoegen?
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className=" px-4 py-1.5 text-sm text-ink-muted hover:text-ink/85 hover:bg-white/5 transition-colors"
          >
            Nee
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className=" bg-accent/80 px-4 py-1.5 text-sm text-ink hover:bg-accent transition-colors"
          >
            Ja, samenvoegen
          </button>
        </div>
      </div>
    </div>
  );
}
