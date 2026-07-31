import { NextResponse } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { songArchive } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

// Lightweight lookup so track cards can badge "this is the definitive
// source-of-truth version" (original entry) vs. "this is a translation"
// without pulling the full archive payload.
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select({
      trackId: songArchive.trackId,
      parentId: songArchive.parentId,
    })
    .from(songArchive)
    .where(and(eq(songArchive.userId, auth.userId), isNotNull(songArchive.trackId)));

  const links: Record<string, "original" | "translation"> = {};
  for (const row of rows) {
    if (!row.trackId) continue;
    links[row.trackId] = row.parentId ? "translation" : "original";
  }

  return NextResponse.json({ links });
}
