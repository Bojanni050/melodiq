"use client";

import { useT } from "@/hooks/useT";
import type { LyricStudioSnapshot } from "@/lib/lyrics-studio-types";

export default function LyricsSnapshotModals({
  showLoadSnapshots,
  showSaveSnapshotModal,
  savedSnapshots,
  snapshotNameInput,
  titleMode = false,
  generatingTitle = false,
  onGenerateTitle,
  onCloseLoad,
  onCloseSave,
  onSnapshotNameChange,
  onLoadSnapshot,
  onDeleteSnapshot,
  onSaveSnapshot,
}: {
  showLoadSnapshots: boolean;
  showSaveSnapshotModal: boolean;
  savedSnapshots: LyricStudioSnapshot[];
  snapshotNameInput: string;
  titleMode?: boolean;
  generatingTitle?: boolean;
  onGenerateTitle?: () => void;
  onCloseLoad: () => void;
  onCloseSave: () => void;
  onSnapshotNameChange: (value: string) => void;
  onLoadSnapshot: (snapshot: LyricStudioSnapshot) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
  onSaveSnapshot: () => void;
}) {
  const t = useT();
  return (
    <>
      {showLoadSnapshots && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm" onClick={onCloseLoad}>
          <div className="w-full max-w-2xl  border border-line bg-surface p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-muted">{t("lyricsStudio.loadSavedLyricsHeading")}</h3>
              <button
                type="button"
                onClick={onCloseLoad}
                className="text-ink-dim hover:text-ink-muted"
                title={t("melody.close")}
              >
                x
              </button>
            </div>
            {savedSnapshots.length === 0 ? (
              <p className="text-sm text-ink-dim">{t("lyricsStudio.noSavedSnapshots")}</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {savedSnapshots.map((snapshot) => (
                  <div key={snapshot.id} className="flex items-center gap-2  border border-line bg-white/5 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onLoadSnapshot(snapshot)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm text-ink/85">{snapshot.name}</p>
                      <p className="text-xs text-ink-dim">{new Date(snapshot.createdAt).toLocaleString()}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSnapshot(snapshot.id)}
                      className="px-2 py-1 text-sm text-red-300/80 hover:text-red-200"
                      title={t("lyricsStudio.deleteSnapshotTooltip")}
                    >
                      {t("studio.delete")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showSaveSnapshotModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm" onClick={onCloseSave}>
          <div className="w-full max-w-lg  border border-line bg-surface p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-muted">{titleMode ? t("studio.saveLyrics") : t("lyricsStudio.saveSnapshotHeading")}</h3>
              <button
                type="button"
                onClick={onCloseSave}
                className="text-ink-dim hover:text-ink-muted"
                title={t("melody.close")}
              >
                x
              </button>
            </div>
            {titleMode ? (
              <p className="mb-3 text-sm text-ink-dim">
                {t("lyricsStudio.noTitleYetHint")}
              </p>
            ) : null}
            <input
              type="text"
              value={snapshotNameInput}
              onChange={(event) => onSnapshotNameChange(event.target.value)}
              className="input-field text-sm"
              placeholder={titleMode ? t("lyricsStudio.songTitlePlaceholder") : t("lyricsStudio.snapshotNamePlaceholder")}
            />
            <div className="mt-3 flex items-center gap-2">
              {titleMode && onGenerateTitle ? (
                <button
                  type="button"
                  onClick={onGenerateTitle}
                  disabled={generatingTitle}
                  className="inline-flex items-center gap-2  bg-accent px-3 py-2 text-sm font-semibold text-ink transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {generatingTitle ? t("studio.generating") : t("lyricsStudio.generateTitleButton")}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onSaveSnapshot}
                className="inline-flex items-center gap-2  border border-line bg-white/5 px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-white/10"
              >
                {titleMode ? t("studio.saveLyrics") : t("common.save")}
              </button>
              <button
                type="button"
                onClick={onCloseSave}
                className="inline-flex items-center gap-2  border border-line bg-transparent px-3 py-2 text-sm font-medium text-ink-dim transition hover:bg-white/5 hover:text-ink-muted"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
