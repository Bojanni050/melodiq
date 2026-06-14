import { NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { isNotNull, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { downloadFromS3, uploadToS3 } from "@/lib/s3";
import sharp from "sharp";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const all = await db
    .select({ id: tracks.id, s3KeyCover: tracks.s3KeyCover, s3KeyCoverThumb: tracks.s3KeyCoverThumb })
    .from(tracks)
    .where(isNotNull(tracks.s3KeyCover));

  let done = 0;
  let failed = 0;

  for (const track of all) {
    try {
      const fullBuffer = await downloadFromS3(track.s3KeyCover!);
      const thumbBuffer = await sharp(fullBuffer)
        .resize(120, 120, { fit: "cover" })
        .webp({ quality: 82 })
        .toBuffer();

      const s3KeyCoverThumb = `tracks/${track.id}/cover_thumb.webp`;
      await uploadToS3(s3KeyCoverThumb, thumbBuffer, "image/webp");

      await db
        .update(tracks)
        .set({ s3KeyCoverThumb })
        .where(eq(tracks.id, track.id));

      done++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ total: all.length, done, failed });
}
