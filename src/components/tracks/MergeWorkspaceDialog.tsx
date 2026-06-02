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
      <div className="relative bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl p-6 w-[440px] max-w-[90vw] flex flex-col gap-4">
        <h3 className="text-base font-semibold text-white">Workspace name bestaat al</h3>
        <p className="text-sm text-white/65">
          Er bestaat al een workspace met deze naam: <span className="text-white/90">{workspaceName}</span>.
          Wil je de track(s) daaraan toevoegen en de workspaces samenvoegen?
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-sm text-white/60 hover:text-white/85 hover:bg-white/5 transition-colors"
          >
            Nee
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-primary-500/80 px-4 py-1.5 text-sm text-white hover:bg-primary-500 transition-colors"
          >
            Ja, samenvoegen
          </button>
        </div>
      </div>
    </div>
  );
}
