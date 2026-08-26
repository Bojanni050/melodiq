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
    .select({ id: releases.id })
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

    const isFirst = cnt === 0;

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
        isMain: isFirst,
      })
      .returning();

    // If first cover, also set it as the release's main cover
    if (isFirst) {
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
