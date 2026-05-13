import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getPresignedUrl } from "@/lib/s3";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const hd = searchParams.get("hd") === "true";

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const decoded = verifyToken(token || "");

  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, decoded.userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const track = result[0];
  if (!track.s3Key) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const s3Key = hd && track.s3KeyHd ? track.s3KeyHd : track.s3Key;
  const url = await getPresignedUrl(s3Key);

  return NextResponse.redirect(url);
}
