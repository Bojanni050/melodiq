"use client";

import { memo } from "react";

/**
 * The shared "jump to the now-playing track" pill.
 *
 * `inline` mode is what TrackListHeader renders in the Library list header.
 * `floating` mode pins it a little above the player so a listing whose own
 * header scrolls out of view still keeps the button within reach.
 */
const JumpToCurrentTrackButton = memo(function JumpToCurrentTrackButton({
  onClick,
  floating = false,
  label = "Huidige track",
}: {
  onClick: () => void;
  floating?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Spring naar huidige track"
      className={
        floating
          ? "pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/20 bg-surface-2/95 px-3 py-2 text-xs font-medium text-ink shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all hover:border-white hover:bg-white hover:text-black hover:scale-105 active:scale-95"
          : "shrink-0 flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-ink transition-all hover:border-white hover:bg-white hover:text-black"
      }
    >
      <span>{label}</span>
    </button>
  );
});

export default JumpToCurrentTrackButton;
