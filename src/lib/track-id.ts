// A short, human-glanceable stand-in for a track's full UUID. Two tracks
// can share an identical title (duplicate generations, or an upload that
// matches a generated song's name) — this gives the UI something stable and
// unique to show next to the title so they're never visually indistinguishable.
export function shortTrackId(id: string | null | undefined): string {
  if (!id) return "";
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}
