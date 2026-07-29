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
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const s3Key = hd && track.s3KeyHd ? track.s3KeyHd : track.s3Key;
  const fmt = hd && track.formatHd ? track.formatHd : (track.format ?? "mp3");
  const rawName = track.title ?? "track";
  // HTTP header values must stay within Latin-1 — a title with e.g. Polish,
  // Turkish, or Cyrillic characters (ł, ş, я, ...) throws ERR_INVALID_CHAR
  // if used raw, which surfaced as a 500 on this route. Send an ASCII-safe
  // fallback in `filename` and the real name via the RFC 5987 `filename*`.
  const asciiName = rawName.replace(/[^\x20-\x7E]/g, "_");
  const filename = `${asciiName}.${fmt}`;
  const encodedFilename = encodeURIComponent(`${rawName}.${fmt}`);

  // Fetch the presigned URL then proxy the content server-side
  const presignedUrl = await getPresignedUrl(s3Key);
  const s3Response = await fetch(presignedUrl);

  if (!s3Response.ok) {
    return NextResponse.json({ error: "Failed to fetch audio" }, { status: 502 });
  }

  const contentType = s3Response.headers.get("content-type") ?? `audio/${fmt}`;

  return new NextResponse(s3Response.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "private, no-store",
    },
  });
}
