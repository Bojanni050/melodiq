import { NextRequest, NextResponse } from "next/server";

import { getCachedCover, coverResponse } from "@/lib/cover-cache";
import { parseAccountImageKey } from "@/lib/account-images";

function notFound() {
  return NextResponse.json(
    { error: "Image not found" },
    { status: 404, headers: { "Cache-Control": "public, max-age=300" } }
  );
}

// Public, no auth: serves the account profile/hero images uploaded via
// /api/account/upload-image, whose stored URLs point here. Portraits and hero
// images appear on public artist pages, so they are public by definition —
// only the two image keys per user resolve, nothing else in the bucket.
// (Static sibling /api/account/upload-image keeps winning over this
// catch-all; Next.js prefers exact segments.)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;

  const s3Key = parseAccountImageKey(key);
  if (!s3Key) return notFound();

  try {
    const cover = await getCachedCover(s3Key);
    return coverResponse(request, cover, "public");
  } catch (error: unknown) {
    console.error(`[account-image] failed for ${s3Key}:`, error);
    return notFound();
  }
}
