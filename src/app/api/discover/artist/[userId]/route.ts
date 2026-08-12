import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { tracks, users } from "@/db/schema";

interface AudioDnaShape {
  atmosphereTags?: string[] | null;
}

function parseAtmosphereTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AudioDnaShape;
    return Array.isArray(parsed.atmosphereTags) ? parsed.atmosphereTags : [];
  } catch {
    return [];
  }
}

// Public, no auth: an artist's published tracks + aggregate stats + bio.
// Mirrors getPublishedTracksFeed's privacy boundary (published + done +
// not deleted only) — never exposes lyrics/prompt/unpublished work.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  const [owner] = await db
    .select({ id: users.id, name: users.name, artistAlias: users.artistAlias, bio: users.bio, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!owner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      coverUrl: tracks.coverUrl,
      s3KeyCover: tracks.s3KeyCover,
      duration: tracks.duration,
      playCount: tracks.playCount,
      othersPlayCount: tracks.othersPlayCount,
      publishDate: tracks.publishDate,
      createdAt: tracks.createdAt,
      audioDna: tracks.audioDna,
    })
    .from(tracks)
    .where(
      and(
        eq(tracks.userId, userId),
        eq(tracks.releaseStatus, "published"),
        eq(tracks.status, "done"),
        isNull(tracks.deletedAt),
        isNull(tracks.archivedAt)
      )
    )
    .orderBy(desc(tracks.publishDate));

  const trackList = rows.map((row) => {
    const year = (row.publishDate ?? row.createdAt).getFullYear();
    return {
      id: row.id,
      title: row.title || "Untitled",
      hasCoverProxy: Boolean(!row.coverUrl && row.s3KeyCover),
      coverUrl: row.coverUrl,
      duration: row.duration,
      plays: (row.playCount ?? 0) + (row.othersPlayCount ?? 0),
      year,
    };
  });

  const tagCounts = new Map<string, number>();
  rows.forEach((row) => {
    parseAtmosphereTags(row.audioDna).forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    });
  });
  const genres = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag]) => tag);

  const totalPlays = rows.reduce((sum, row) => sum + (row.playCount ?? 0) + (row.othersPlayCount ?? 0), 0);
  const sinceYear = rows.length
    ? Math.min(...rows.map((r) => (r.publishDate ?? r.createdAt).getFullYear()))
    : owner.createdAt.getFullYear();
  const heroTrack = rows.find((r) => r.coverUrl || r.s3KeyCover) ?? null;

  return NextResponse.json({
    artist: {
      id: owner.id,
      name: owner.artistAlias || owner.name || "Unknown Artist",
      bio: owner.bio,
      genres,
      stats: {
        tracks: trackList.length,
        totalPlays,
        sinceYear,
      },
      heroCoverUrl: heroTrack?.coverUrl || null,
      heroHasCoverProxy: heroTrack ? Boolean(!heroTrack.coverUrl && heroTrack.s3KeyCover) : false,
      heroTrackId: heroTrack?.id ?? null,
    },
    tracks: trackList,
  });
}
