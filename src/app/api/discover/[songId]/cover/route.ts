import { NextRequest, NextResponse } from "next/server";

import { getPublishedSongPlayableTrack } from "@/lib/songs";
import { getCachedCover } from "@/lib/cover-cache";

// Public, no auth: only ever serves a cover for a track belonging to a song
// with releaseStatus === "published" — re-verified on every request.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params;

  const track = await getPublishedSongPlayableTrack(songId);
  if (!track || !track.s3KeyCover) {
    return NextResponse.json({ error: "No cover art available" }, { status: 404 });
  }

  const isThumb = new URL(request.url).searchParams.get("thumb") === "1";
  const s3Key = isThumb && track.s3KeyCoverThumb ? track.s3KeyCoverThumb : track.s3KeyCover;

  try {
    const { buffer, cached, contentType } = await getCachedCover(s3Key);

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Cover-Cache": cached ? "hit" : "miss",
      },
    });
  } catch (error: any) {
    console.error(`[discover/cover] failed for song ${songId}:`, error?.message ?? error);
    return NextResponse.json(
      { error: "Cover not found" },
      { status: 404, headers: { "Cache-Control": "public, max-age=300" } }
    );
  }
}
