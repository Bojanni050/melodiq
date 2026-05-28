"use client";

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
  return (
    <>
      {showLoadSnapshots && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm" onClick={onCloseLoad}>
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#11111a] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white/80">Load saved lyrics</h3>
              <button
                type="button"
                onClick={onCloseLoad}
                className="text-white/40 hover:text-white/70"
                title="Close"
              >
                x
              </button>
            </div>
            {savedSnapshots.length === 0 ? (
              <p className="text-xs text-white/45">No saved snapshots yet.</p>
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
                      className="px-2 py-1 text-xs text-red-300/80 hover:text-red-200"
                      title="Delete snapshot"
                    >
                      Delete
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
              <h3 className="text-sm font-semibold text-white/80">{titleMode ? "Save lyrics" : "Save lyrics snapshot"}</h3>
              <button
                type="button"
                onClick={onCloseSave}
                className="text-white/40 hover:text-white/70"
                title="Close"
              >
                x
              </button>
            </div>
            {titleMode ? (
              <p className="mb-3 text-xs text-white/45">
                No title set yet. Generate one from the current lyrics, or enter a title manually.
              </p>
            ) : null}
            <input
              type="text"
              value={snapshotNameInput}
              onChange={(event) => onSnapshotNameChange(event.target.value)}
              className="input-field text-sm"
              placeholder={titleMode ? "Song title" : "Snapshot naam"}
            />
            <div className="mt-3 flex items-center gap-2">
              {titleMode && onGenerateTitle ? (
                <button
                  type="button"
                  onClick={onGenerateTitle}
                  disabled={generatingTitle}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {generatingTitle ? "Generating..." : "Generate title"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onSaveSnapshot}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10"
              >
                {titleMode ? "Save lyrics" : "Save"}
              </button>
              <button
                type="button"
                onClick={onCloseSave}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-xs font-medium text-white/50 transition hover:bg-white/5 hover:text-white/80"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
