import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { artistPages } from "@/db/schema";
import { getCachedCover, coverResponse } from "@/lib/cover-cache";
import { ensureWorkspaceSchema } from "@/lib/workspaces";

// Public, no auth: serves an artist page's own profile image or hero by slug.
// Artwork on a published artist page is public by definition, and only the two
// image keys are read — no bio, no owner data. Anything missing 404s.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  await ensureWorkspaceSchema();

  const [page] = await db
    .select({ imageS3Key: artistPages.imageS3Key, heroS3Key: artistPages.heroS3Key })
    .from(artistPages)
    .where(eq(artistPages.slug, slug))
    .limit(1);

  const variant = new URL(request.url).searchParams.get("variant");
  const s3Key =
    variant === "hero" ? page?.heroS3Key : variant === "profile" ? page?.imageS3Key : undefined;

  if (!s3Key) {
    return NextResponse.json(
      { error: "Image not found" },
      { status: 404, headers: { "Cache-Control": "public, max-age=300" } }
    );
  }

  try {
    const cover = await getCachedCover(s3Key);
    return coverResponse(request, cover, "public");
  } catch (error: unknown) {
    console.error(`[artist-page-image] failed for ${s3Key}:`, error);
    return NextResponse.json(
      { error: "Image not found" },
      { status: 404, headers: { "Cache-Control": "public, max-age=300" } }
    );
  }
}
