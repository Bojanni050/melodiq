import type { Playlist } from "./playlistStore";
import type { Release } from "./releaseStore";

/**
 * Single-entry memo keyed on argument identity.
 *
 * The store arrays are replaced wholesale on every mutation, so identity is an
 * exact change signal — and because these live at module scope, every mounted
 * TrackCard shares one computed index instead of rebuilding its own.
 */
function memoizeByIdentity<In, Out>(compute: (input: In) => Out): (input: In) => Out {
  let lastInput: In | undefined;
  let lastOutput: Out;
  let primed = false;

  return (input: In): Out => {
    if (primed && input === lastInput) return lastOutput;
    lastInput = input;
    lastOutput = compute(input);
    primed = true;
    return lastOutput;
  };
}

/**
 * trackId -> the first playlist containing it.
 *
 * Replaces a per-card `playlists.find(p => p.trackIds.includes(id))`, which was
 * O(playlists x tracks-per-playlist) for every card on every playlist-store
 * change.
 */
export const playlistByTrackId = memoizeByIdentity((playlists: Playlist[]) => {
  const index = new Map<string, Playlist>();
  for (const playlist of playlists) {
    for (const trackId of playlist.trackIds) {
      if (!index.has(trackId)) index.set(trackId, playlist);
    }
  }
  return index;
});

/**
 * Every trackId that appears on at least one release. Replaces a per-card
 * `releases.some(r => r.tracks.some(...))`.
 */
export const releasedTrackIds = memoizeByIdentity((releases: Release[]) => {
  const index = new Set<string>();
  for (const release of releases) {
    for (const track of release.tracks) {
      index.add(track.trackId);
    }
  }
  return index;
});
