import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const decoded = verifyToken(token || "");
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allSettings = await db.select().from(settings);
  const settingsMap: Record<string, string> = {};
  for (const s of allSettings) {
    settingsMap[s.key] = s.value;
  }
  return NextResponse.json(settingsMap);
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const decoded = verifyToken(token || "");
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { key, value } = body;

  if (!key || typeof value !== "string") {
    return NextResponse.json({ error: "Key and value are required" }, { status: 400 });
  }

  const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1);

  if (existing.length > 0) {
    await db.update(settings).set({ value }).where(eq(settings.key, key));
  } else {
    await db.insert(settings).values({ key, value });
  }

  return NextResponse.json({ success: true });
}
