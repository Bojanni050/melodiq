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
      <div className="relative bg-surface border border-line  shadow-2xl p-6 w-[440px] max-w-[90vw] flex flex-col gap-4">
        <h3 className="text-base font-semibold text-ink">
          {addedCount > 0
            ? `${addedCount} track${addedCount !== 1 ? "s" : ""} toegevoegd aan ${playlistName}`
            : `Tracks al in playlist`}
        </h3>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-ink/65">
            {duplicateTitles.length === 1
              ? "Dit nummer staat al in"
              : `Deze ${duplicateTitles.length} nummers staan al in`}{" "}
            <span className="text-ink">{playlistName}</span>:
          </p>
          <ul className="mt-1 flex flex-col gap-0.5 max-h-48 overflow-y-auto">
            {duplicateTitles.map((title, i) => (
              <li key={i} className="text-sm text-ink/75 px-2 py-0.5 rounded bg-white/5">
                {title}
              </li>
            ))}
          </ul>
          <p className="text-sm text-ink/55 mt-1">Wil je {duplicateTitles.length === 1 ? "het" : "ze"} toch toevoegen?</p>
        </div>
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
            onClick={onAddAnyway}
            className=" bg-accent/80 px-4 py-1.5 text-sm text-ink hover:bg-accent transition-colors"
          >
            Ja, toch toevoegen
          </button>
        </div>
      </div>
    </div>
  );
}
