import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { savedLyrics } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select()
    .from(savedLyrics)
    .where(eq(savedLyrics.userId, auth.userId))
    .orderBy(desc(savedLyrics.createdAt));

  return NextResponse.json({
    savedLyrics: rows.map((r) => ({
      id: r.id,
      title: r.title,
      lyrics: r.lyrics,
      savedAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const lyrics = typeof body?.lyrics === "string" ? body.lyrics.trim() : "";

  if (!lyrics) {
    return NextResponse.json({ error: "Lyrics are required" }, { status: 400 });
  }

  const inserted = await db
    .insert(savedLyrics)
    .values({ userId: auth.userId, title: title || "Untitled", lyrics })
    .returning();

  const row = inserted[0];
  return NextResponse.json({
    savedLyric: {
      id: row.id,
      title: row.title,
      lyrics: row.lyrics,
      savedAt: row.createdAt.toISOString(),
    },
  });
}
