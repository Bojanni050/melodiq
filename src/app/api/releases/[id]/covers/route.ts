import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { releases, coverImages } from "@/db/schema";
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
    .where(and(eq(coverImages.entityType, "release"), eq(coverImages.entityId, id), eq(coverImages.userId, userId)))
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

  // Verify release ownership
  const releaseResult = await db
    .select({ id: releases.id, s3KeyCover: releases.s3KeyCover })
    .from(releases)
    .where(and(eq(releases.id, id), eq(releases.userId, userId)));

  if (releaseResult.length === 0) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }

  // Check current count
  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(coverImages)
    .where(and(eq(coverImages.entityType, "release"), eq(coverImages.entityId, id), eq(coverImages.userId, userId)));

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

    const { s3Key, s3KeyThumb } = await processAndUploadCoverImage(buffer, id, coverId, "release");

    // Adopt the upload as the release's cover only when the release has none of
    // its own -- including the single-track case, where the manager is showing
    // a borrowed track cover and the release still needs its own.
    //
    // This used to key off `cnt === 0`, i.e. "no uploaded covers yet". But the
    // existing cover lives in releases.s3KeyCover and never had a cover_images
    // row, so that test was true on the first upload even when the release
    // already had a cover -- and adding an image silently overwrote it.
    // Promoting a cover is an explicit action; see [coverId]/main.
    const becomesReleaseCover = !releaseResult[0].s3KeyCover;

    const [inserted] = await db
      .insert(coverImages)
      .values({
        id: coverId,
        userId,
        entityType: "release",
        entityId: id,
        s3Key,
        s3KeyThumb,
        position: cnt,
        isMain: becomesReleaseCover,
      })
      .returning();

    if (becomesReleaseCover) {
      await db
        .update(releases)
        .set({ s3KeyCover: s3Key, s3KeyCoverThumb: s3KeyThumb, updatedAt: new Date() })
        .where(eq(releases.id, id));
    }

    return NextResponse.json({ cover: inserted }, { status: 201 });
  } catch (error: unknown) {
    console.error(`[release-covers/POST] failed for release ${id}:`, error);
    return NextResponse.json({ error: "Failed to upload cover" }, { status: 500 });
  }
}
