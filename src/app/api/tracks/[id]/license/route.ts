import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getPresignedUrl } from "@/lib/s3";
import { requireAuth } from "@/lib/require-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const result = await db
    .select({ s3KeyLicense: tracks.s3KeyLicense })
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)))
    .limit(1);

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const { s3KeyLicense } = result[0];
  if (!s3KeyLicense) {
    return NextResponse.json({ error: "No license file attached" }, { status: 404 });
  }

  const url = await getPresignedUrl(s3KeyLicense);
  return NextResponse.redirect(url);
}
