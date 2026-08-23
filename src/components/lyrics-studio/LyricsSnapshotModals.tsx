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
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#11111a] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white/80">{t("lyricsStudio.loadSavedLyricsHeading")}</h3>
              <button
                type="button"
                onClick={onCloseLoad}
                className="text-white/40 hover:text-white/70"
                title={t("melody.close")}
              >
                x
              </button>
            </div>
            {savedSnapshots.length === 0 ? (
              <p className="text-sm text-white/45">{t("lyricsStudio.noSavedSnapshots")}</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {savedSnapshots.map((snapshot) => (
                  <div key={snapshot.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onLoadSnapshot(snapshot)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm text-white/85">{snapshot.name}</p>
                      <p className="text-xs text-white/45">{new Date(snapshot.createdAt).toLocaleString()}</p>
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
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#11111a] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white/80">{titleMode ? t("studio.saveLyrics") : t("lyricsStudio.saveSnapshotHeading")}</h3>
              <button
                type="button"
                onClick={onCloseSave}
                className="text-white/40 hover:text-white/70"
                title={t("melody.close")}
              >
                x
              </button>
            </div>
            {titleMode ? (
              <p className="mb-3 text-sm text-white/45">
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
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {generatingTitle ? t("studio.generating") : t("lyricsStudio.generateTitleButton")}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onSaveSnapshot}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
              >
                {titleMode ? t("studio.saveLyrics") : t("common.save")}
              </button>
              <button
                type="button"
                onClick={onCloseSave}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm font-medium text-white/50 transition hover:bg-white/5 hover:text-white/80"
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
