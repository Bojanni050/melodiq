import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { releases } from "@/db/schema";
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
    .select({ s3KeyCover: releases.s3KeyCover, s3KeyCoverThumb: releases.s3KeyCoverThumb })
    .from(releases)
    .where(and(eq(releases.id, id), eq(releases.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }

  const release = result[0];
  if (!release.s3KeyCover) {
    return NextResponse.json({ error: "No cover art available" }, { status: 404 });
  }

  try {
    const { buffer, cached, contentType } = await getCachedCover(release.s3KeyCover);
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
    console.error(`[release-cover/GET] failed for release ${id}:`, error?.message ?? error);
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
    .select({ id: releases.id })
    .from(releases)
    .where(and(eq(releases.id, id), eq(releases.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("cover");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "No cover file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { s3KeyCover, s3KeyCoverThumb } = await processAndUploadCover(buffer, `release-${id}`);

    await db.update(releases).set({
      s3KeyCover,
      s3KeyCoverThumb,
      updatedAt: new Date(),
    }).where(eq(releases.id, id));

    return NextResponse.json({ coverUrl: `/api/releases/${id}/cover` });
  } catch (error: any) {
    console.error(`[release-cover/POST] failed for release ${id}:`, error?.message ?? error);
    return NextResponse.json({ error: "Failed to upload cover" }, { status: 500 });
  }
}
