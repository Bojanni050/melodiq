import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { getPresignedUrl } from "@/lib/s3";
import { contentTypeForFormat } from "@/lib/audio-format";

export const dynamic = "force-dynamic";

/**
 * Returns a short-lived presigned S3 URL for the track so Chromecast
 * can fetch the audio without needing a session cookie.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const hd = new URL(request.url).searchParams.get("hd") === "true";

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
  const s3Key = hd && track.s3KeyHd ? track.s3KeyHd : track.s3Key;
  if (!s3Key) {
    return NextResponse.json({ error: "No audio available" }, { status: 404 });
  }

  const fmt = (hd && track.formatHd ? track.formatHd : track.format ?? "mp3") as "mp3" | "wav" | "flac";
  const expiresIn = 3600; // 1 hour

  try {
    const url = await getPresignedUrl(s3Key, expiresIn);
    return NextResponse.json({
      url,
      contentType: contentTypeForFormat(fmt),
      format: fmt,
      expiresIn,
    });
  } catch (err) {
    console.error("cast-url: presign failed", err);
    return NextResponse.json({ error: "Failed to generate cast URL" }, { status: 500 });
  }
}
