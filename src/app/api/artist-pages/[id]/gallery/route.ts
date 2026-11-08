import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import sharp from "sharp";

import { db } from "@/db";
import { artistPages } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { ensureWorkspaceSchema } from "@/lib/workspaces";
import { deleteFromS3, uploadToS3 } from "@/lib/s3";
import { invalidateCachedCover } from "@/lib/cover-cache";
import { ARTIST_PAGE_GALLERY_MAX, galleryPhotoId, parseGalleryKeys } from "@/lib/artist-pages";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// Gallery photos are shown at most ~1600px wide; storing the 4000px original
// would only make every visitor download more.
const MAX_DIMENSION = 2400;

async function findOwnPage(id: string, userId: string) {
  const [page] = await db
    .select({ id: artistPages.id, galleryS3Keys: artistPages.galleryS3Keys })
    .from(artistPages)
    .where(and(eq(artistPages.id, id), eq(artistPages.userId, userId)))
    .limit(1);
  return page ?? null;
}

// Adds photos to a page's gallery. Accepts several `files` per request so a
// multi-select in the file picker is one round trip. Every photo gets its own
// uuid key (unlike profile/hero, which overwrite a fixed key), re-encoded to
// avif and capped in size.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  await ensureWorkspaceSchema();

  const { id } = await params;
  const page = await findOwnPage(id, userId);
  if (!page) {
    return NextResponse.json({ error: "Artist page not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "files are required" }, { status: 400 });
  }

  const keys = parseGalleryKeys(page.galleryS3Keys);
  if (keys.length + files.length > ARTIST_PAGE_GALLERY_MAX) {
    return NextResponse.json(
      { error: `Gallery is limited to ${ARTIST_PAGE_GALLERY_MAX} photos` },
      { status: 400 }
    );
  }

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Files must be images" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Image too large (max 10 MB)" }, { status: 400 });
    }
  }

  const added: string[] = [];
  for (const file of files) {
    let buffer: Buffer;
    try {
      buffer = await sharp(Buffer.from(await file.arrayBuffer()))
        .rotate()
        .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
        .avif({ quality: 75 })
        .toBuffer();
    } catch {
      return NextResponse.json({ error: "Could not process image" }, { status: 400 });
    }
    const key = `artist-pages/${userId}/${page.id}/gallery/${randomUUID()}.avif`;
    await uploadToS3(key, buffer, "image/avif");
    added.push(key);
  }

  const next = [...keys, ...added];
  await db
    .update(artistPages)
    .set({ galleryS3Keys: JSON.stringify(next), updatedAt: new Date() })
    .where(and(eq(artistPages.id, page.id), eq(artistPages.userId, userId)));

  return NextResponse.json({ ok: true, added: added.length });
}

// Removes one photo by its public id. Matching against the stored list (rather
// than trusting a client-supplied key) keeps the delete scoped to this page.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  await ensureWorkspaceSchema();

  const { id } = await params;
  const page = await findOwnPage(id, userId);
  if (!page) {
    return NextResponse.json({ error: "Artist page not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { photoId?: unknown };
  const photoId = typeof body.photoId === "string" ? body.photoId : "";
  const keys = parseGalleryKeys(page.galleryS3Keys);
  const target = keys.find((k) => galleryPhotoId(k) === photoId);
  if (!target) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  await db
    .update(artistPages)
    .set({
      galleryS3Keys: JSON.stringify(keys.filter((k) => k !== target)),
      updatedAt: new Date(),
    })
    .where(and(eq(artistPages.id, page.id), eq(artistPages.userId, userId)));

  // Best effort: the row no longer references the file, so a failed S3 delete
  // only leaves an orphan, it never breaks the page.
  await Promise.all([
    invalidateCachedCover(target),
    deleteFromS3(target).catch((error: unknown) =>
      console.error(`[artist-page-gallery] S3 delete failed for ${target}:`, error)
    ),
  ]);

  return NextResponse.json({ ok: true });
}
