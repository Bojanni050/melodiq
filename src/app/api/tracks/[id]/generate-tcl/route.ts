export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { generateTimeCodedLyrics } from "@/lib/tcl/generate";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { id } = await params;

  const [track] = await db
    .select({ userId: tracks.userId, status: tracks.status })
    .from(tracks)
    .where(eq(tracks.id, id))
    .limit(1);

  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const [userRow] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const isAdmin = userRow?.role === "admin";
  const isOwner = track.userId === userId;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (track.status !== "done") {
    return NextResponse.json({ error: "Track isn't ready yet" }, { status: 400 });
  }

  const result = await generateTimeCodedLyrics(id);
  if (!result.success) {
    return NextResponse.json({ error: result.error || "Generation failed" }, { status: 502 });
  }

  return NextResponse.json(result);
}
