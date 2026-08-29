import { NextRequest, NextResponse } from "next/server";

import { getPublishedTrackById } from "@/lib/songs";
import { getCachedCover, coverResponse } from "@/lib/cover-cache";

// Public, no auth: only ever serves a cover for a track with
// releaseStatus === "published" — re-verified on every request.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const { trackId } = await params;

  const track = await getPublishedTrackById(trackId);
  if (!track || !track.s3KeyCover) {
    return NextResponse.json({ error: "No cover art available" }, { status: 404 });
  }

  const isThumb = new URL(request.url).searchParams.get("thumb") === "1";
  const s3Key = isThumb && track.s3KeyCoverThumb ? track.s3KeyCoverThumb : track.s3KeyCover;

  try {
    const cover = await getCachedCover(s3Key);
    return coverResponse(request, cover, "public");
  } catch (error: any) {
    console.error(`[discover/cover] failed for track ${trackId}:`, error?.message ?? error);
    return NextResponse.json(
      { error: "Cover not found" },
      { status: 404, headers: { "Cache-Control": "public, max-age=300" } }
    );
  }
}
