import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { songs } from "@/db/schema";
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

  try {
    const target = await db
      .select({ id: songs.id })
      .from(songs)
      .where(and(eq(songs.id, id), eq(songs.userId, auth.userId)))
      .limit(1);

    if (!target[0]) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    // tracks.song_id is ON DELETE SET NULL, so this un-groups the song's
    // track versions instead of deleting them.
    await db.delete(songs).where(and(eq(songs.id, id), eq(songs.userId, auth.userId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[songs/delete]", error);
    return NextResponse.json({ error: "Failed to delete song" }, { status: 500 });
  }
}
