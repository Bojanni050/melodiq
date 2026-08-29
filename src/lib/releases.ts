import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { releases, releaseTracks, tracks } from "@/db/schema";

export type ReleaseTrackPayload = {
  trackId: string;
  position: number;
  side: string | null;
};

export type ReleasePayload = {
  id: string;
  title: string;
  type: string;
  kind: string | null;
  artistName: string | null;
  writerName: string | null;
  composerName: string | null;
  credits: string | null;
  description: string | null;
  coverUrl: string | null;
  /** False when `coverUrl` is only a borrowed fallback from the release's sole track. */
  hasOwnCover: boolean;
  releaseDate: string | null;
  isPublic: boolean;
  isSpotlight: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tracks: ReleaseTrackPayload[];
};

export async function getUserReleasesWithTracks(userId: string): Promise<ReleasePayload[]> {
  const releaseRows = await db
    .select({
      id: releases.id,
      title: releases.title,
      type: releases.type,
      kind: releases.kind,
      artistName: releases.artistName,
      writerName: releases.writerName,
      composerName: releases.composerName,
      credits: releases.credits,
      description: releases.description,
      s3KeyCover: releases.s3KeyCover,
      releaseDate: releases.releaseDate,
      isPublic: releases.isPublic,
      isSpotlight: releases.isSpotlight,
      publishedAt: releases.publishedAt,
      createdAt: releases.createdAt,
      updatedAt: releases.updatedAt,
    })
    .from(releases)
    .where(eq(releases.userId, userId))
    .orderBy(asc(releases.createdAt));

  if (releaseRows.length === 0) return [];

  const releaseIds = releaseRows.map((row) => row.id);
  const releaseTrackRows = await db
    .select({
      releaseId: releaseTracks.releaseId,
      trackId: releaseTracks.trackId,
      position: releaseTracks.position,
      side: releaseTracks.side,
    })
    .from(releaseTracks)
    .where(inArray(releaseTracks.releaseId, releaseIds))
    .orderBy(asc(releaseTracks.releaseId), asc(releaseTracks.position));

  const tracksByReleaseId = new Map<string, ReleaseTrackPayload[]>();
  releaseTrackRows.forEach((row) => {
    const list = tracksByReleaseId.get(row.releaseId) ?? [];
    list.push({ trackId: row.trackId, position: row.position, side: row.side ?? null });
    tracksByReleaseId.set(row.releaseId, list);
  });

  // A release with no cover of its own and exactly one track adopts that
  // track's cover art by default, so single-track releases don't show a
  // blank placeholder.
  const soleTrackIdByReleaseId = new Map<string, string>();
  releaseRows.forEach((row) => {
    if (row.s3KeyCover) return;
    const releaseTracksList = tracksByReleaseId.get(row.id) ?? [];
    if (releaseTracksList.length === 1) {
      soleTrackIdByReleaseId.set(row.id, releaseTracksList[0].trackId);
    }
  });

  const fallbackCoverByTrackId = new Map<string, string | null>();
  if (soleTrackIdByReleaseId.size > 0) {
    const trackRows = await db
      .select({ id: tracks.id, coverUrl: tracks.coverUrl, s3KeyCover: tracks.s3KeyCover })
      .from(tracks)
      .where(inArray(tracks.id, Array.from(soleTrackIdByReleaseId.values())));

    trackRows.forEach((row) => {
      fallbackCoverByTrackId.set(row.id, row.coverUrl || (row.s3KeyCover ? `/api/tracks/${row.id}/cover` : null));
    });
  }

  return releaseRows.map((row) => {
    const soleTrackId = soleTrackIdByReleaseId.get(row.id);
    const coverUrl = row.s3KeyCover
      ? `/api/releases/${row.id}/cover`
      : soleTrackId
        ? fallbackCoverByTrackId.get(soleTrackId) ?? null
        : null;

    return {
      id: row.id,
      title: row.title,
      type: row.type,
      kind: row.kind ?? null,
      artistName: row.artistName ?? null,
      writerName: row.writerName ?? null,
      composerName: row.composerName ?? null,
      credits: row.credits ?? null,
      description: row.description ?? null,
      coverUrl,
      hasOwnCover: !!row.s3KeyCover,
      releaseDate: row.releaseDate?.toISOString() ?? null,
      isPublic: row.isPublic,
      isSpotlight: row.isSpotlight,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      tracks: tracksByReleaseId.get(row.id) ?? [],
    };
  });
}

export async function getUserReleaseById(userId: string, releaseId: string) {
  const rows = await db
    .select({
      id: releases.id,
      userId: releases.userId,
      title: releases.title,
      type: releases.type,
      kind: releases.kind,
      isPublic: releases.isPublic,
      isSpotlight: releases.isSpotlight,
      createdAt: releases.createdAt,
    })
    .from(releases)
    .where(and(eq(releases.userId, userId), eq(releases.id, releaseId)))
    .limit(1);

  return rows[0] ?? null;
}
