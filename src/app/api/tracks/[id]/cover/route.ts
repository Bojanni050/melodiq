import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { getCachedCover } from "@/lib/cover-cache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const result = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const track = result[0];
  if (!track.s3KeyCover) {
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
        "Cache-Control": "private, max-age=86400, immutable",
        "X-Cover-Cache": cached ? "hit" : "miss",
      },
    });
  } catch (error: any) {
    console.error(`[cover-cache] failed for track ${id}:`, error?.message ?? error);
    // Return a cacheable 404 so the browser stops retrying on every poll
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "private, max-age=300" },
    });
  }
}
