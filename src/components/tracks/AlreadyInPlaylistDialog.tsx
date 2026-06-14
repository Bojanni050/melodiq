"use client";

interface AlreadyInPlaylistDialogProps {
  isOpen: boolean;
  onClose: () => void;
  playlistName: string;
  duplicateTitles: string[];
  addedCount: number;
  onAddAnyway: () => void;
}

export default function AlreadyInPlaylistDialog({
  isOpen,
  onClose,
  playlistName,
  duplicateTitles,
  addedCount,
  onAddAnyway,
}: AlreadyInPlaylistDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl p-6 w-[440px] max-w-[90vw] flex flex-col gap-4">
        <h3 className="text-base font-semibold text-white">
          {addedCount > 0
            ? `${addedCount} track${addedCount !== 1 ? "s" : ""} toegevoegd aan ${playlistName}`
            : `Tracks al in playlist`}
        </h3>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-white/65">
            {duplicateTitles.length === 1
              ? "Dit nummer staat al in"
              : `Deze ${duplicateTitles.length} nummers staan al in`}{" "}
            <span className="text-white/90">{playlistName}</span>:
          </p>
          <ul className="mt-1 flex flex-col gap-0.5 max-h-48 overflow-y-auto">
            {duplicateTitles.map((title, i) => (
              <li key={i} className="text-sm text-white/75 px-2 py-0.5 rounded bg-white/5">
                {title}
              </li>
            ))}
          </ul>
          <p className="text-sm text-white/55 mt-1">Wil je {duplicateTitles.length === 1 ? "het" : "ze"} toch toevoegen?</p>
        </div>
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
            onClick={onAddAnyway}
            className="rounded-lg bg-primary-500/80 px-4 py-1.5 text-sm text-white hover:bg-primary-500 transition-colors"
          >
            Ja, toch toevoegen
          </button>
        </div>
      </div>
    </div>
  );
}
