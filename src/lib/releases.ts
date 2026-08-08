import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { releases, releaseTracks } from "@/db/schema";

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
  description: string | null;
  coverUrl: string | null;
  releaseDate: string | null;
  isPublic: boolean;
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
      description: releases.description,
      s3KeyCover: releases.s3KeyCover,
      releaseDate: releases.releaseDate,
      isPublic: releases.isPublic,
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

  return releaseRows.map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    kind: row.kind ?? null,
    artistName: row.artistName ?? null,
    description: row.description ?? null,
    coverUrl: row.s3KeyCover ? `/api/releases/${row.id}/cover` : null,
    releaseDate: row.releaseDate?.toISOString() ?? null,
    isPublic: row.isPublic,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    tracks: tracksByReleaseId.get(row.id) ?? [],
  }));
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
      createdAt: releases.createdAt,
    })
    .from(releases)
    .where(and(eq(releases.userId, userId), eq(releases.id, releaseId)))
    .limit(1);

  return rows[0] ?? null;
}
