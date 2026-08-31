export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks, users, trackAlignments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { beginTimeCodedLyricsGeneration, runTimeCodedLyricsAlignment } from "@/lib/tcl/generate";

async function authorizeTrack(id: string, userId: string) {
  const [track] = await db
    .select({ userId: tracks.userId, status: tracks.status })
    .from(tracks)
    .where(eq(tracks.id, id))
    .limit(1);

  if (!track) {
    return { error: NextResponse.json({ error: "Track not found" }, { status: 404 }) };
  }

  const [userRow] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const isAdmin = userRow?.role === "admin";
  const isOwner = track.userId === userId;
  if (!isAdmin && !isOwner) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { track };
}

/** Current alignment status — the client polls this instead of waiting on
 * the POST response, since the alignment itself runs in the background. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const { error } = await authorizeTrack(id, auth.userId);
  if (error) return error;

  const [alignment] = await db
    .select({ status: trackAlignments.status, error: trackAlignments.error, confidence: trackAlignments.confidence })
    .from(trackAlignments)
    .where(eq(trackAlignments.trackId, id))
    .limit(1);

  return NextResponse.json({ trackId: id, ...(alignment ?? { status: "none" }) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const { error, track } = await authorizeTrack(id, auth.userId);
  if (error) return error;

  if (track!.status !== "done") {
    return NextResponse.json({ error: "Track isn't ready yet" }, { status: 400 });
  }

  const [existing] = await db
    .select({ status: trackAlignments.status })
    .from(trackAlignments)
    .where(eq(trackAlignments.trackId, id))
    .limit(1);

  if (existing?.status === "processing") {
    return NextResponse.json({ trackId: id, started: false, status: "processing" }, { status: 202 });
  }

  const begin = await beginTimeCodedLyricsGeneration(id);
  if (!begin.ok) {
    return NextResponse.json({ trackId: id, error: begin.error }, { status: 400 });
  }

  // Fire-and-forget: QuickLRC alignment can take up to ~90s, well past most
  // reverse-proxy gateway timeouts. The "processing" row is already
  // persisted at this point, so the client can safely start polling GET.
  void runTimeCodedLyricsAlignment(id).catch((err) => {
    console.error(`[generate-tcl] background alignment failed for track ${id}:`, err);
  });

  return NextResponse.json({ trackId: id, started: true, status: "processing" }, { status: 202 });
}
