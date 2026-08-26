import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks, coverImages } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";

export async function PATCH(
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

  // Unset current main
  await db
    .update(coverImages)
    .set({ isMain: false })
    .where(and(eq(coverImages.entityType, "track"), eq(coverImages.entityId, id), eq(coverImages.userId, userId)));

  // Set new main
  await db.update(coverImages).set({ isMain: true }).where(eq(coverImages.id, coverId));

  // Update track's main cover
  await db
    .update(tracks)
    .set({ s3KeyCover: cover.s3Key, s3KeyCoverThumb: cover.s3KeyThumb, coverUrl: `/api/tracks/${id}/cover?t=${Date.now()}`, updatedAt: new Date() })
    .where(eq(tracks.id, id));

  return NextResponse.json({ success: true });
}
