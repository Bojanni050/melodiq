export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { db } from "@/db";
import { users, tracks } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { trackId, lyricsTimestamps } = body as {
    trackId?: unknown;
    lyricsTimestamps?: unknown;
  };

  if (typeof trackId !== "string" || !trackId.trim()) {
    return NextResponse.json({ error: "trackId is required" }, { status: 400 });
  }
  if (typeof lyricsTimestamps !== "string") {
    return NextResponse.json(
      { error: "lyricsTimestamps must be a string" },
      { status: 400 }
    );
  }

  // Fetch the track to check ownership
  const [track] = await db
    .select({ userId: tracks.userId })
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);

  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  // Check ownership — admin bypasses
  const [userRow] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1);

  const isAdmin = userRow?.role === "admin";
  const isOwner = track.userId === auth.userId;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Update only the lyricsTimestamps column — never touch the lyrics column
  await db
    .update(tracks)
    .set({ lyricsTimestamps })
    .where(eq(tracks.id, trackId));

  return NextResponse.json({ success: true });
}
