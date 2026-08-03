import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { songArchive, tracks } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { analyzeTrackDna } from "@/lib/track-dna-analysis";
import { addTrackToMasterTracksPlaylist } from "@/lib/playlists";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const updates: Partial<typeof songArchive.$inferInsert> = {};
  if (typeof body?.title === "string") {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    updates.title = title;
  }
  if (typeof body?.lyrics === "string") updates.lyrics = body.lyrics.trim();
  if (typeof body?.prompt === "string") updates.prompt = body.prompt.trim();
  if (typeof body?.notes === "string") updates.notes = body.notes.trim();
  if (typeof body?.language === "string") updates.language = body.language.trim() || null;
  if ("trackId" in (body || {})) {
    const trackId = typeof body.trackId === "string" && body.trackId ? body.trackId : null;
    if (trackId) {
      const owned = await db
        .select({ id: tracks.id })
        .from(tracks)
        .where(and(eq(tracks.id, trackId), eq(tracks.userId, auth.userId)))
        .limit(1);
      if (owned.length === 0) {
        return NextResponse.json({ error: "Track not found" }, { status: 400 });
      }
    }
    updates.trackId = trackId;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }
  updates.updatedAt = new Date();

  const before = await db
    .select({ trackId: songArchive.trackId })
    .from(songArchive)
    .where(and(eq(songArchive.id, id), eq(songArchive.userId, auth.userId)))
    .limit(1);

  const result = await db
    .update(songArchive)
    .set(updates)
    .where(and(eq(songArchive.id, id), eq(songArchive.userId, auth.userId)))
    .returning();

  if (result.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = result[0];

  if (row.trackId && row.trackId !== before[0]?.trackId) {
    // Keeps the user's "Master Tracks" playlist in sync with what's linked.
    await addTrackToMasterTracksPlaylist(auth.userId, row.trackId).catch((error) => {
      console.error(`[archive] failed to add track ${row.trackId} to Master Tracks playlist:`, error);
    });

    // Fire-and-forget: newly linking a track as a master track auto-runs
    // composition analysis (and backfills lyrics analysis if it's missing),
    // regardless of the AUTO_ANALYZE_COMPOSITION setting.
    void analyzeTrackDna(row.trackId, { includeLyricsIfMissing: true }).catch((error) => {
      console.error(`[archive] auto-analysis failed for track ${row.trackId}:`, error);
    });
  }

  return NextResponse.json({
    entry: {
      id: row.id,
      parentId: row.parentId,
      language: row.language,
      title: row.title,
      lyrics: row.lyrics,
      prompt: row.prompt,
      notes: row.notes,
      trackId: row.trackId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  await db
    .delete(songArchive)
    .where(and(eq(songArchive.id, id), eq(songArchive.userId, auth.userId)));

  return NextResponse.json({ ok: true });
}
