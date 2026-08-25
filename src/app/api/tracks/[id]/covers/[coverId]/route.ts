import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks, coverImages } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { deleteFromS3 } from "@/lib/s3";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; coverId: string }> }
) {
  const { id, coverId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  // Find the cover
  const [cover] = await db
    .select()
    .from(coverImages)
    .where(and(eq(coverImages.id, coverId), eq(coverImages.entityType, "track"), eq(coverImages.entityId, id), eq(coverImages.userId, userId)));

  if (!cover) {
    return NextResponse.json({ error: "Cover not found" }, { status: 404 });
  }

  // Delete from S3
  try {
    await Promise.all([
      deleteFromS3(cover.s3Key),
      cover.s3KeyThumb ? deleteFromS3(cover.s3KeyThumb) : Promise.resolve(),
    ]);
  } catch (e) {
    console.error(`[covers/DELETE] S3 delete failed for ${cover.s3Key}:`, e);
  }

  // Delete from DB
  await db.delete(coverImages).where(eq(coverImages.id, coverId));

  // If this was the main cover, promote the next one
  if (cover.isMain) {
    const remaining = await db
      .select()
      .from(coverImages)
      .where(and(eq(coverImages.entityType, "track"), eq(coverImages.entityId, id), eq(coverImages.userId, userId)))
      .orderBy(asc(coverImages.position));

    if (remaining.length > 0) {
      const newMain = remaining[0];
      await db.update(coverImages).set({ isMain: true }).where(eq(coverImages.id, newMain.id));
      await db
        .update(tracks)
        .set({ s3KeyCover: newMain.s3Key, s3KeyCoverThumb: newMain.s3KeyThumb, updatedAt: new Date() })
        .where(eq(tracks.id, id));
    } else {
      // No covers left — clear the track's main cover
      await db
        .update(tracks)
        .set({ s3KeyCover: null, s3KeyCoverThumb: null, coverUrl: null, updatedAt: new Date() })
        .where(eq(tracks.id, id));
    }
  }

  // Reorder remaining positions
  const remaining = await db
    .select()
    .from(coverImages)
    .where(and(eq(coverImages.entityType, "track"), eq(coverImages.entityId, id), eq(coverImages.userId, userId)))
    .orderBy(asc(coverImages.position));

  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].position !== i) {
      await db.update(coverImages).set({ position: i }).where(eq(coverImages.id, remaining[i].id));
    }
  }

  return NextResponse.json({ success: true });
}
