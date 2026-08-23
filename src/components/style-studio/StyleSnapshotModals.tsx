"use client";

import { useT } from "@/hooks/useT";
import type { StyleSnapshot } from "@/lib/style-studio-types";

export default function StyleSnapshotModals({
  showSave,
  showLoad,
  snapshotName,
  setSnapshotName,
  onConfirmSave,
  onCancelSave,
  savedSnapshots,
  onLoad,
  onDelete,
  onCancelLoad,
}: {
  showSave: boolean;
  showLoad: boolean;
  snapshotName: string;
  setSnapshotName: (v: string) => void;
  onConfirmSave: () => void;
  onCancelSave: () => void;
  savedSnapshots: StyleSnapshot[];
  onLoad: (snapshot: StyleSnapshot) => void;
  onDelete: (id: string) => void;
  onCancelLoad: () => void;
}) {
  const t = useT();
  return (
    <>
      {showSave && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm" onClick={onCancelSave}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1a24] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white mb-3">{t("melody.saveStyleHeading")}</h3>
            <input
              type="text"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              placeholder={t("melody.styleNamePlaceholder")}
              className="w-full input-field text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && snapshotName.trim()) onConfirmSave();
              }}
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancelSave}
                className="rounded-lg px-4 py-1.5 text-sm text-white/60 hover:text-white/85 hover:bg-white/5 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={onConfirmSave}
                disabled={!snapshotName.trim()}
                className="rounded-lg border border-primary-400/30 bg-primary-500/20 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoad && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm" onClick={onCancelLoad}>
          <div className="w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col rounded-2xl border border-white/10 bg-[#1a1a24] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white mb-3">{t("melody.loadStyleHeading")}</h3>
            <div className="flex-1 overflow-y-auto space-y-2 -mx-1 px-1">
              {savedSnapshots.length === 0 ? (
                <p className="text-sm text-white/50 py-4 text-center">{t("melody.noSavedStyles")}</p>
              ) : (
                savedSnapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{snapshot.name}</p>
                      <p className="text-xs text-white/40">
                        {new Date(snapshot.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onLoad(snapshot)}
                        className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                      >
                        {t("studio.load")}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(snapshot.id)}
                        className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-200 transition hover:bg-red-500/20"
                      >
                        {t("studio.delete")}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex items-center justify-end">
              <button
                type="button"
                onClick={onCancelLoad}
                className="rounded-lg px-4 py-1.5 text-sm text-white/60 hover:text-white/85 hover:bg-white/5 transition-colors"
              >
                {t("melody.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
