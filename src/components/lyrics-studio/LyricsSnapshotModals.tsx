"use client";

import type { LyricStudioSnapshot } from "@/lib/lyrics-studio-types";

export default function LyricsSnapshotModals({
  showLoadSnapshots,
  showSaveSnapshotModal,
  savedSnapshots,
  snapshotNameInput,
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
              <h3 className="text-sm font-semibold text-white/80">Save lyrics snapshot</h3>
              <button
                type="button"
                onClick={onCloseSave}
                className="text-white/40 hover:text-white/70"
                title="Close"
              >
                x
              </button>
            </div>
            <input
              type="text"
              value={snapshotNameInput}
              onChange={(event) => onSnapshotNameChange(event.target.value)}
              className="input-field text-sm"
              placeholder="Snapshot naam"
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={onSaveSnapshot}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10"
              >
                Save
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
