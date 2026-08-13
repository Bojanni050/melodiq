import { describe, expect, it } from "vitest";
import { evaluateArchiveGuard } from "../track-archive-guards";

const NOT_BLOCKED = {
  releaseStatus: "concept",
  releaseTitles: [] as string[],
  masterTrackTitle: null as string | null,
  playlistNames: [] as string[],
};

describe("evaluateArchiveGuard", () => {
  it("is not blocked when the track has no relations", () => {
    const result = evaluateArchiveGuard(NOT_BLOCKED);
    expect(result.blocked).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it("blocks a published track", () => {
    const result = evaluateArchiveGuard({ ...NOT_BLOCKED, releaseStatus: "published" });
    expect(result.blocked).toBe(true);
    expect(result.reasons).toEqual([{ type: "released", detail: "Track is published" }]);
  });

  it("blocks a concept-status track that is a member of a release", () => {
    const result = evaluateArchiveGuard({ ...NOT_BLOCKED, releaseTitles: ["Debut EP"] });
    expect(result.blocked).toBe(true);
    expect(result.reasons).toEqual([{ type: "released", detail: 'Track is part of release "Debut EP"' }]);
  });

  it("summarizes multiple release memberships", () => {
    const result = evaluateArchiveGuard({ ...NOT_BLOCKED, releaseTitles: ["EP One", "EP Two"] });
    expect(result.reasons[0].detail).toBe("Track is part of 2 releases");
  });

  it("blocks a track linked to a Master Track", () => {
    const result = evaluateArchiveGuard({ ...NOT_BLOCKED, masterTrackTitle: "Original Song" });
    expect(result.blocked).toBe(true);
    expect(result.reasons).toEqual([{ type: "masterTrack", detail: 'Linked to Master Track "Original Song"' }]);
  });

  it("blocks a track that is in a regular playlist", () => {
    const result = evaluateArchiveGuard({ ...NOT_BLOCKED, playlistNames: ["Favorites"] });
    expect(result.blocked).toBe(true);
    expect(result.reasons).toEqual([{ type: "inPlaylist", detail: 'In playlist "Favorites"' }]);
  });

  it("summarizes multiple playlists", () => {
    const result = evaluateArchiveGuard({ ...NOT_BLOCKED, playlistNames: ["Favorites", "Roadtrip", "Chill"] });
    expect(result.reasons[0].detail).toBe('In playlist "Favorites" (and 2 more)');
  });

  it("does not double-report the system Master Tracks playlist as inPlaylist", () => {
    // The caller (fetchArchiveFacts) already excludes system playlists from
    // playlistNames, so a master-track-linked track should surface only the
    // masterTrack reason, not a duplicate inPlaylist reason.
    const result = evaluateArchiveGuard({ ...NOT_BLOCKED, masterTrackTitle: "Original Song", playlistNames: [] });
    expect(result.reasons).toEqual([{ type: "masterTrack", detail: 'Linked to Master Track "Original Song"' }]);
  });

  it("combines all applicable reasons", () => {
    const result = evaluateArchiveGuard({
      releaseStatus: "published",
      releaseTitles: [],
      masterTrackTitle: "Original Song",
      playlistNames: ["Favorites"],
    });
    expect(result.blocked).toBe(true);
    expect(result.reasons.map((r) => r.type)).toEqual(["released", "masterTrack", "inPlaylist"]);
  });
});
