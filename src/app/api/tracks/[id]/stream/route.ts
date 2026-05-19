import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getPresignedUrl } from "@/lib/s3";
import { requireAuth } from "@/lib/require-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const hd = searchParams.get("hd") === "true";

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
  if (!track.s3Key) {
    return NextResponse.json({ error: "No audio available" }, { status: 404 });
  }

  const s3Key = hd && track.s3KeyHd ? track.s3KeyHd : track.s3Key;
  const fmt = hd && track.formatHd ? track.formatHd : (track.format ?? "mp3");

  // Presigned URL valid for 5 minutes.
  const url = await getPresignedUrl(s3Key, 300);

  return NextResponse.json(
    { url, format: fmt },
    {
      headers: {
        // Cache this response for 4 minutes so the same URL can be reused.
        "Cache-Control": "private, max-age=240",
      },
    }
  );
}
