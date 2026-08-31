// A short, human-glanceable stand-in for a track's full UUID. Two tracks
// can share an identical title (duplicate generations, or an upload that
// matches a generated song's name) — this gives the UI something stable and
// unique to show next to the title so they're never visually indistinguishable.
export function shortTrackId(id: string | null | undefined): string {
  if (!id) return "";
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

/**
 * Guards a track action's response against having landed on the wrong track
 * — a stale closure, a route mix-up, anything that would otherwise silently
 * apply a convert/analyze/regenerate result to the wrong row's local state.
 * Returns true when the response is safe to apply; false (after logging)
 * when the server's trackId doesn't match what this action was fired for.
 */
export function isForExpectedTrack(
  responseTrackId: string | null | undefined,
  expectedTrackId: string,
  action: string
): boolean {
  if (!responseTrackId) return true; // endpoint doesn't echo trackId — nothing to check
  if (responseTrackId === expectedTrackId) return true;
  console.error(
    `[${action}] response trackId mismatch: expected ${expectedTrackId} (#${shortTrackId(expectedTrackId)}) but got ${responseTrackId} (#${shortTrackId(responseTrackId)})`
  );
  return false;
}
