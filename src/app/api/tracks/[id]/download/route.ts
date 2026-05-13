import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const track = await prisma.track.findFirst({
    where: { id, userId: decoded.userId },
  });

  if (!track || !track.s3Key) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const s3Key = hd && track.s3KeyHd ? track.s3KeyHd : track.s3Key;
  const url = await getPresignedUrl(s3Key);

  return NextResponse.redirect(url);
}
