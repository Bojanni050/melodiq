import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { releases, releaseTracks, tracks } from "@/db/schema";
import { getCachedCover, coverResponse } from "@/lib/cover-cache";

// Public, no auth: only ever serves art for a published (isPublic) release.
// Falls back to a random cover among the release's tracks when the release
// has no cover of its own. Mirrors /api/discover/playlists/[id]/cover.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [release] = await db
    .select({ s3KeyCover: releases.s3KeyCover, s3KeyCoverThumb: releases.s3KeyCoverThumb })
    .from(releases)
    .where(and(eq(releases.id, id), eq(releases.isPublic, true)))
    .limit(1);

  if (!release) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }

  let s3Key = release.s3KeyCover;
  let s3KeyThumb = release.s3KeyCoverThumb;

  if (!s3Key) {
    const candidates = await db
      .select({ s3KeyCover: tracks.s3KeyCover, s3KeyCoverThumb: tracks.s3KeyCoverThumb })
      .from(releaseTracks)
      .innerJoin(tracks, eq(tracks.id, releaseTracks.trackId))
      .where(and(eq(releaseTracks.releaseId, id), isNotNull(tracks.s3KeyCover)));

    if (candidates.length === 0) {
      return NextResponse.json({ error: "No cover art available" }, { status: 404 });
    }

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    s3Key = pick.s3KeyCover;
    s3KeyThumb = pick.s3KeyCoverThumb;
  }

  const isThumb = new URL(request.url).searchParams.get("thumb") === "1";
  const key = isThumb && s3KeyThumb ? s3KeyThumb : s3Key!;

  try {
    const cover = await getCachedCover(key);
    return coverResponse(request, cover, "public");
  } catch (error: any) {
    console.error(`[discover-release-cover] failed for release ${id}:`, error?.message ?? error);
    return NextResponse.json(
      { error: "Cover not found" },
      { status: 404, headers: { "Cache-Control": "public, max-age=300" } }
    );
  }
}
