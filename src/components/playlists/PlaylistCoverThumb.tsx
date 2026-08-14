"use client";

import { useState } from "react";

// Renders the playlist cover art (explicit cover, or the server-resolved
// fallback to a track cover from inside the playlist — see
// /api/discover/playlists/[id]/cover) inside `boxClassName`, falling back to
// `fallback` if the playlist has no cover art at all (404).
export default function PlaylistCoverThumb({
  playlistId,
  alt,
  boxClassName,
  fallback,
  overlay,
}: {
  playlistId: string;
  alt: string;
  boxClassName: string;
  fallback: React.ReactNode;
  overlay?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={boxClassName}>
      {!failed ? (
        <img
          src={`/api/discover/playlists/${playlistId}/cover`}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        fallback
      )}
      {overlay}
    </div>
  );
}
