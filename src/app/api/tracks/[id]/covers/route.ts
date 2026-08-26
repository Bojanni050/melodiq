import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks, coverImages } from "@/db/schema";
import { eq, and, asc, count } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { processAndUploadCoverImage } from "@/lib/generate-cover";

const MAX_COVERS = 5;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const result = await db
    .select()
    .from(coverImages)
    .where(and(eq(coverImages.entityType, "track"), eq(coverImages.entityId, id), eq(coverImages.userId, userId)))
    .orderBy(asc(coverImages.position));

  return NextResponse.json({ covers: result });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  // Verify track ownership
  const trackResult = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

  if (trackResult.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  // Check current count
  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(coverImages)
    .where(and(eq(coverImages.entityType, "track"), eq(coverImages.entityId, id), eq(coverImages.userId, userId)));

  if (cnt >= MAX_COVERS) {
    return NextResponse.json({ error: `Maximum ${MAX_COVERS} covers allowed` }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("cover");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "No cover file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const coverId = crypto.randomUUID();

    const { s3Key, s3KeyThumb } = await processAndUploadCoverImage(buffer, id, coverId, "track");

    const isFirst = cnt === 0;

    const [inserted] = await db
      .insert(coverImages)
      .values({
        id: coverId,
        userId,
        entityType: "track",
        entityId: id,
        s3Key,
        s3KeyThumb,
        position: cnt,
        isMain: isFirst,
      })
      .returning();

    // If first cover, also set it as the track's main cover
    if (isFirst) {
      await db
        .update(tracks)
        .set({ s3KeyCover: s3Key, s3KeyCoverThumb: s3KeyThumb, coverUrl: `/api/tracks/${id}/cover`, updatedAt: new Date() })
        .where(eq(tracks.id, id));
    }

    return NextResponse.json({ cover: inserted }, { status: 201 });
  } catch (error: unknown) {
    console.error(`[covers/POST] failed for track ${id}:`, error);
    return NextResponse.json({ error: "Failed to upload cover" }, { status: 500 });
  }
}
