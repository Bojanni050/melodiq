import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { playlists, playlistTracks, releases, releaseTracks, songArchive, tracks } from "@/db/schema";

export type ArchiveBlockReason =
  | { type: "released"; detail: string }
  | { type: "masterTrack"; detail: string }
  | { type: "inPlaylist"; detail: string };

export type ArchiveGuardResult = {
  blocked: boolean;
  reasons: ArchiveBlockReason[];
};

type TrackArchiveFacts = {
  releaseStatus: string;
  releaseTitles: string[];
  masterTrackTitle: string | null;
  playlistNames: string[];
};

const NOT_BLOCKED: TrackArchiveFacts = {
  releaseStatus: "concept",
  releaseTitles: [],
  masterTrackTitle: null,
  playlistNames: [],
};

// Pure core: no DB access, so this is directly unit-testable.
export function evaluateArchiveGuard(facts: TrackArchiveFacts): ArchiveGuardResult {
  const reasons: ArchiveBlockReason[] = [];

  if (facts.releaseStatus === "published") {
    reasons.push({ type: "released", detail: "Track is published" });
  } else if (facts.releaseTitles.length > 0) {
    const detail =
      facts.releaseTitles.length === 1
        ? `Track is part of release "${facts.releaseTitles[0]}"`
        : `Track is part of ${facts.releaseTitles.length} releases`;
    reasons.push({ type: "released", detail });
  }

  if (facts.masterTrackTitle !== null) {
    reasons.push({ type: "masterTrack", detail: `Linked to Master Track "${facts.masterTrackTitle}"` });
  }

  // System playlists (e.g. "Master Tracks") are excluded here — that relation
  // is already reported via the masterTrack reason above, and we don't want
  // to report the same underlying fact twice under two reason types.
  if (facts.playlistNames.length > 0) {
    const detail =
      facts.playlistNames.length === 1
        ? `In playlist "${facts.playlistNames[0]}"`
        : `In playlist "${facts.playlistNames[0]}" (and ${facts.playlistNames.length - 1} more)`;
    reasons.push({ type: "inPlaylist", detail });
  }

  return { blocked: reasons.length > 0, reasons };
}

async function fetchArchiveFacts(trackIds: string[], userId: string): Promise<Map<string, TrackArchiveFacts>> {
  const facts = new Map<string, TrackArchiveFacts>();
  if (trackIds.length === 0) return facts;

  const trackRows = await db
    .select({ id: tracks.id, releaseStatus: tracks.releaseStatus })
    .from(tracks)
    .where(and(inArray(tracks.id, trackIds), eq(tracks.userId, userId)));

  for (const row of trackRows) {
    // Fresh arrays per track — NOT_BLOCKED's arrays must never be shared/mutated.
    facts.set(row.id, { releaseStatus: row.releaseStatus, releaseTitles: [], masterTrackTitle: null, playlistNames: [] });
  }

  const ownedIds = Array.from(facts.keys());
  if (ownedIds.length === 0) return facts;

  const [releaseRows, masterRows, playlistRows] = await Promise.all([
    db
      .select({ trackId: releaseTracks.trackId, title: releases.title })
      .from(releaseTracks)
      .innerJoin(releases, eq(releaseTracks.releaseId, releases.id))
      .where(inArray(releaseTracks.trackId, ownedIds)),
    db
      .select({ trackId: songArchive.trackId, title: songArchive.title })
      .from(songArchive)
      .where(and(inArray(songArchive.trackId, ownedIds), eq(songArchive.userId, userId))),
    db
      .select({ trackId: playlistTracks.trackId, name: playlists.name })
      .from(playlistTracks)
      .innerJoin(playlists, eq(playlistTracks.playlistId, playlists.id))
      .where(and(inArray(playlistTracks.trackId, ownedIds), eq(playlists.isSystem, false))),
  ]);

  for (const row of releaseRows) {
    facts.get(row.trackId)?.releaseTitles.push(row.title);
  }
  for (const row of masterRows) {
    if (!row.trackId) continue;
    const f = facts.get(row.trackId);
    if (f) f.masterTrackTitle = row.title;
  }
  for (const row of playlistRows) {
    facts.get(row.trackId)?.playlistNames.push(row.name);
  }

  return facts;
}

export async function checkTracksArchiveGuard(
  trackIds: string[],
  userId: string
): Promise<Map<string, ArchiveGuardResult>> {
  const facts = await fetchArchiveFacts(trackIds, userId);
  const result = new Map<string, ArchiveGuardResult>();
  for (const id of trackIds) {
    result.set(id, evaluateArchiveGuard(facts.get(id) ?? NOT_BLOCKED));
  }
  return result;
}

export async function checkTrackArchiveGuard(trackId: string, userId: string): Promise<ArchiveGuardResult> {
  const result = await checkTracksArchiveGuard([trackId], userId);
  return result.get(trackId) ?? { blocked: false, reasons: [] };
}
