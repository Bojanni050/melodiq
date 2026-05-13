import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const decoded = verifyToken(token || "");
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    endpoint: process.env.S3_ENDPOINT || "Not configured",
    region: process.env.S3_REGION || "Not configured",
    bucket: process.env.S3_BUCKET || "Not configured",
    forcePathStyle: true,
  });
}
