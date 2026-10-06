import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import sharp from "sharp";

import { db } from "@/db";
import { artistPages } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { ensureWorkspaceSchema } from "@/lib/workspaces";
import { uploadToS3 } from "@/lib/s3";
import { invalidateCachedCover } from "@/lib/cover-cache";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Uploads a page's own profile image or hero. Mirrors /api/account/upload-image
// (avif, per-type fixed key so re-uploading overwrites instead of piling up),
// but scopes both the S3 key and the ownership check to one artist page.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  await ensureWorkspaceSchema();

  const { id } = await params;
  const [page] = await db
    .select({
      id: artistPages.id,
      userId: artistPages.userId,
      imageS3Key: artistPages.imageS3Key,
      heroS3Key: artistPages.heroS3Key,
    })
    .from(artistPages)
    .where(and(eq(artistPages.id, id), eq(artistPages.userId, userId)))
    .limit(1);

  if (!page) {
    return NextResponse.json({ error: "Artist page not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const type = formData.get("type");
  const file = formData.get("file");

  if (type !== "profile" && type !== "hero") {
    return NextResponse.json({ error: "type must be 'profile' or 'hero'" }, { status: 400 });
  }
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Image too large (max 10 MB)" }, { status: 400 });
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());

  let uploadBuffer: Buffer;
  let ext: string;
  let contentType: string;

  try {
    const metadata = await sharp(rawBuffer).metadata();
    const format = metadata.format;

    if (format === "avif" || format === "webp") {
      uploadBuffer = rawBuffer;
      ext = format;
      contentType = format === "avif" ? "image/avif" : "image/webp";
    } else {
      uploadBuffer = await sharp(rawBuffer).avif({ quality: 80 }).toBuffer();
      ext = "avif";
      contentType = "image/avif";
    }
  } catch {
    uploadBuffer = rawBuffer;
    ext = file.name.split(".").pop() || "jpg";
    contentType = file.type || "image/jpeg";
  }

  const key = `artist-pages/${userId}/${page.id}/${type}.${ext}`;
  await uploadToS3(key, uploadBuffer, contentType);

  // Both branches bump updatedAt — the display URLs version-cache-bust on it,
  // otherwise the browser's immutable max-age=86400 cache keeps showing the
  // previous upload for up to a day even after a successful replace.
  await db
    .update(artistPages)
    .set(type === "profile"
      ? { imageS3Key: key, updatedAt: new Date() }
      : { heroS3Key: key, updatedAt: new Date() })
    .where(and(eq(artistPages.id, page.id), eq(artistPages.userId, userId)));

  const oldKey = type === "profile" ? page.imageS3Key : page.heroS3Key;
  await Promise.all([
    invalidateCachedCover(key),
    oldKey && oldKey !== key ? invalidateCachedCover(oldKey) : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true, type });
}
