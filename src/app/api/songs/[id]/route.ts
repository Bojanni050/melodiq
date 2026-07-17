import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { songs, tracks } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { getUserSongWithTrackVersions } from "@/lib/songs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const song = await getUserSongWithTrackVersions(auth.userId, id);
  if (!song) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  return NextResponse.json({ song });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const deleteTracks = new URL(request.url).searchParams.get("deleteTracks") === "true";

  try {
    const target = await db
      .select({ id: songs.id })
      .from(songs)
      .where(and(eq(songs.id, id), eq(songs.userId, auth.userId)))
      .limit(1);

    if (!target[0]) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    if (deleteTracks) {
      // Soft delete — move the song's track versions to the recycle bin,
      // matching how deleting an individual track behaves.
      await db
        .update(tracks)
        .set({ deletedAt: new Date() })
        .where(and(eq(tracks.songId, id), eq(tracks.userId, auth.userId)));
    }

    // tracks.song_id is ON DELETE SET NULL — when deleteTracks is false this
    // un-groups the song's track versions instead of deleting them.
    await db.delete(songs).where(and(eq(songs.id, id), eq(songs.userId, auth.userId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[songs/delete]", error);
    return NextResponse.json({ error: "Failed to delete song" }, { status: 500 });
  }
}
