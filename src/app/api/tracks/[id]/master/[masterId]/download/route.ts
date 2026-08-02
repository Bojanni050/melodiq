import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks, trackMasters } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getPresignedUrl } from "@/lib/s3";
import { requireAuth } from "@/lib/require-auth";
import { masterVariationLabel } from "@/lib/master-types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; masterId: string }> }
) {
  const { id, masterId } = await params;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const result = await db
    .select({ master: trackMasters, track: tracks })
    .from(trackMasters)
    .innerJoin(tracks, eq(trackMasters.trackId, tracks.id))
    .where(and(eq(trackMasters.id, masterId), eq(trackMasters.trackId, id), eq(tracks.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Master not found" }, { status: 404 });
  }

  const { master, track } = result[0];
  if (!master.s3Key) {
    return NextResponse.json({ error: "Master not found" }, { status: 404 });
  }

  const fmt = master.format ?? "mp3";
  const rawName = `${track.title ?? "track"} - ${masterVariationLabel(master.variationCategory)} Master`;
  const asciiName = rawName.replace(/[^\x20-\x7E]/g, "_");
  const filename = `${asciiName}.${fmt}`;
  const encodedFilename = encodeURIComponent(`${rawName}.${fmt}`);

  const presignedUrl = await getPresignedUrl(master.s3Key);
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
