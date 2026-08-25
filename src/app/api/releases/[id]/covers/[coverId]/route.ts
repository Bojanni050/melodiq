import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { releases, coverImages } from "@/db/schema";
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

  const [cover] = await db
    .select()
    .from(coverImages)
    .where(and(eq(coverImages.id, coverId), eq(coverImages.entityType, "release"), eq(coverImages.entityId, id), eq(coverImages.userId, userId)));

  if (!cover) {
    return NextResponse.json({ error: "Cover not found" }, { status: 404 });
  }

  try {
    await Promise.all([
      deleteFromS3(cover.s3Key),
      cover.s3KeyThumb ? deleteFromS3(cover.s3KeyThumb) : Promise.resolve(),
    ]);
  } catch (e) {
    console.error(`[release-covers/DELETE] S3 delete failed for ${cover.s3Key}:`, e);
  }

  await db.delete(coverImages).where(eq(coverImages.id, coverId));

  if (cover.isMain) {
    const remaining = await db
      .select()
      .from(coverImages)
      .where(and(eq(coverImages.entityType, "release"), eq(coverImages.entityId, id), eq(coverImages.userId, userId)))
      .orderBy(asc(coverImages.position));

    if (remaining.length > 0) {
      const newMain = remaining[0];
      await db.update(coverImages).set({ isMain: true }).where(eq(coverImages.id, newMain.id));
      await db
        .update(releases)
        .set({ s3KeyCover: newMain.s3Key, s3KeyCoverThumb: newMain.s3KeyThumb, updatedAt: new Date() })
        .where(eq(releases.id, id));
    } else {
      await db
        .update(releases)
        .set({ s3KeyCover: null, s3KeyCoverThumb: null, updatedAt: new Date() })
        .where(eq(releases.id, id));
    }
  }

  // Reorder remaining
  const remaining = await db
    .select()
    .from(coverImages)
    .where(and(eq(coverImages.entityType, "release"), eq(coverImages.entityId, id), eq(coverImages.userId, userId)))
    .orderBy(asc(coverImages.position));

  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].position !== i) {
      await db.update(coverImages).set({ position: i }).where(eq(coverImages.id, remaining[i].id));
    }
  }

  return NextResponse.json({ success: true });
}
