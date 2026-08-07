export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { db } from "@/db";
import { users, tracks, trackAlignments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { toLyricsTimestampsMirror } from "@/lib/tcl/generate";
import type { TclDocument } from "@/lib/tcl/types";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { trackId, tcl } = body as { trackId?: unknown; tcl?: unknown };

  if (typeof trackId !== "string" || !trackId.trim()) {
    return NextResponse.json({ error: "trackId is required" }, { status: 400 });
  }
  if (!tcl || typeof tcl !== "object" || !Array.isArray((tcl as TclDocument).lines)) {
    return NextResponse.json({ error: "tcl must be a TclDocument" }, { status: 400 });
  }
  const doc = tcl as TclDocument;

  const [track] = await db
    .select({ userId: tracks.userId })
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);

  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

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

  await db
    .update(trackAlignments)
    .set({ tcl: JSON.stringify(doc), updatedAt: new Date() })
    .where(eq(trackAlignments.trackId, trackId));

  await db
    .update(tracks)
    .set({ lyricsTimestamps: toLyricsTimestampsMirror(doc) })
    .where(eq(tracks.id, trackId));

  return NextResponse.json({ success: true });
}
