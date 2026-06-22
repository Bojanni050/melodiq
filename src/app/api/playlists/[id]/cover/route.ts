import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { playlists } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { getCachedCover } from "@/lib/cover-cache";
import { processAndUploadCover } from "@/lib/generate-cover";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const result = await db
    .select({ s3KeyCover: playlists.s3KeyCover, s3KeyCoverThumb: playlists.s3KeyCoverThumb })
    .from(playlists)
    .where(and(eq(playlists.id, id), eq(playlists.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
  }

  const playlist = result[0];
  if (!playlist.s3KeyCover) {
    return NextResponse.json({ error: "No cover art available" }, { status: 404 });
  }

  try {
    const { buffer, cached, contentType } = await getCachedCover(playlist.s3KeyCover);
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
    console.error(`[playlist-cover/GET] failed for playlist ${id}:`, error?.message ?? error);
    return NextResponse.json({ error: "Cover not found" }, { status: 404 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const result = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(and(eq(playlists.id, id), eq(playlists.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("cover");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "No cover file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { s3KeyCover, s3KeyCoverThumb } = await processAndUploadCover(buffer, `playlist-${id}`);

    await db.update(playlists).set({
      s3KeyCover,
      s3KeyCoverThumb,
      updatedAt: new Date(),
    }).where(eq(playlists.id, id));

    return NextResponse.json({ coverUrl: `/api/playlists/${id}/cover` });
  } catch (error: any) {
    console.error(`[playlist-cover/POST] failed for playlist ${id}:`, error?.message ?? error);
    return NextResponse.json({ error: "Failed to upload cover" }, { status: 500 });
  }
}
