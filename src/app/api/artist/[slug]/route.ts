import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { artistPages, tracks, users } from "@/db/schema";
import { getCdnUrl } from "@/lib/cdn-server";
import { prefixCdn } from "@/lib/cdn";
import { ensureWorkspaceSchema } from "@/lib/workspaces";
import { publishedArtistTracksFilter } from "@/lib/artist-pages";

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

// Public, no auth: the artist page at /artist/[slug] — page copy, the tracks
// credited to that artist name, and aggregate stats.
//
// The track set is derived, not stored: it is every published track of the
// owner whose artist_name equals the page's alias. Same privacy boundary as
// /api/discover/artist/[userId] (published + done, not deleted/archived/hidden)
// and the same cover-URL rewrite, since owner-gated /api/tracks/{id}/cover
// would 404 for every visitor except the owner.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  await ensureWorkspaceSchema();

  const [page] = await db
    .select({
      id: artistPages.id,
      alias: artistPages.alias,
      slug: artistPages.slug,
      bio: artistPages.bio,
      imageS3Key: artistPages.imageS3Key,
      heroS3Key: artistPages.heroS3Key,
      userId: artistPages.userId,
    })
    .from(artistPages)
    .where(eq(artistPages.slug, slug))
    .limit(1);

  if (!page) {
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
    .where(publishedArtistTracksFilter(page.userId, page.alias))
    .orderBy(desc(tracks.publishDate));

  const [owner] = await db
    .select({ bio: users.bio, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, page.userId))
    .limit(1);

  const cdnUrl = await getCdnUrl();
  const rewriteCoverUrl = (url: string | null) =>
    url?.startsWith("/api/tracks/")
      ? prefixCdn(cdnUrl, url.replace("/api/tracks/", "/api/discover/"))
      : url || null;
  const withDiscoverProxy = (trackId: string) => prefixCdn(cdnUrl, `/api/discover/${trackId}/cover`);

  const trackList = rows.map((row) => {
    const year = (row.publishDate ?? row.createdAt).getFullYear();
    return {
      id: row.id,
      title: row.title || "Untitled",
      hasCoverProxy: Boolean(!row.coverUrl && row.s3KeyCover),
      coverUrl: rewriteCoverUrl(row.coverUrl),
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
    : owner?.createdAt?.getFullYear() ?? new Date().getFullYear();

  const heroTrack = rows.find((r) => r.coverUrl || r.s3KeyCover) ?? null;
  const imageUrl = (variant: "profile" | "hero") =>
    prefixCdn(cdnUrl, `/api/artist/${page.slug}/image?variant=${variant}`);

  return NextResponse.json({
    artist: {
      id: page.userId,
      name: page.alias,
      // Page copy wins; the account bio is the fallback so a page created with
      // one click still reads as finished.
      bio: page.bio ?? owner?.bio ?? null,
      genres,
      stats: {
        tracks: trackList.length,
        totalPlays,
        sinceYear,
      },
      imageUrl: page.imageS3Key ? imageUrl("profile") : null,
      heroUrl: page.heroS3Key ? imageUrl("hero") : heroTrack ? rewriteCoverUrl(heroTrack.coverUrl) || withDiscoverProxy(heroTrack.id) : null,
    },
    tracks: trackList,
  });
}
