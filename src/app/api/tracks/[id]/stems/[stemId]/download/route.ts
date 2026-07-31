import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks, trackStems } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getPresignedUrl } from "@/lib/s3";
import { requireAuth } from "@/lib/require-auth";
import { stemTypeLabel } from "@/lib/stem-types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stemId: string }> }
) {
  const { id, stemId } = await params;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const result = await db
    .select({ stem: trackStems, track: tracks })
    .from(trackStems)
    .innerJoin(tracks, eq(trackStems.trackId, tracks.id))
    .where(and(eq(trackStems.id, stemId), eq(trackStems.trackId, id), eq(tracks.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Stem not found" }, { status: 404 });
  }

  const { stem, track } = result[0];
  if (!stem.s3Key) {
    return NextResponse.json({ error: "Stem not found" }, { status: 404 });
  }

  const fmt = stem.format ?? "mp3";
  const rawName = `${track.title ?? "track"} - ${stemTypeLabel(stem.stemType)}`;
  const asciiName = rawName.replace(/[^\x20-\x7E]/g, "_");
  const filename = `${asciiName}.${fmt}`;
  const encodedFilename = encodeURIComponent(`${rawName}.${fmt}`);

  const presignedUrl = await getPresignedUrl(stem.s3Key);
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
