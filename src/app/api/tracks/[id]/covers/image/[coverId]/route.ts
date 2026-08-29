import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { coverImages } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCachedCover, coverResponse } from "@/lib/cover-cache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; coverId: string }> }
) {
  const { id, coverId } = await params;

  const [cover] = await db
    .select()
    .from(coverImages)
    .where(and(eq(coverImages.id, coverId), eq(coverImages.entityType, "track"), eq(coverImages.entityId, id)));

  if (!cover) {
    return NextResponse.json({ error: "Cover not found" }, { status: 404 });
  }

  const isThumb = new URL(request.url).searchParams.get("thumb") === "1";
  const s3Key = isThumb && cover.s3KeyThumb ? cover.s3KeyThumb : cover.s3Key;

  try {
    const cover = await getCachedCover(s3Key);
    return coverResponse(request, cover, "private");
  } catch (error: unknown) {
    console.error(`[cover-image] failed for ${s3Key}:`, error);
    return NextResponse.json({ error: "Cover not found" }, { status: 404 });
  }
}
