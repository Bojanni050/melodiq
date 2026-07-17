import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { songs, tracks } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { getUserSongWithTrackVersions } from "@/lib/songs";
import { RELEASE_STATUSES, type ReleaseStatus } from "@/lib/release-status";

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const target = await db
    .select({ id: songs.id })
    .from(songs)
    .where(and(eq(songs.id, id), eq(songs.userId, auth.userId)))
    .limit(1);

  if (!target[0]) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  try {
    const body: unknown = await request.json();
    if (!isJsonObject(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const releaseStatus = body.releaseStatus;
    const publishDate = body.publishDate;
    const title = body.title;
    const lyrics = body.lyrics;
    const prompt = body.prompt;
    const notes = body.notes;
    const songDna = body.songDna;
    const votingEnabled = body.votingEnabled;

    if (
      releaseStatus === undefined &&
      publishDate === undefined &&
      title === undefined &&
      lyrics === undefined &&
      prompt === undefined &&
      notes === undefined &&
      songDna === undefined &&
      votingEnabled === undefined
    ) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
    }

    const updates: Partial<typeof songs.$inferInsert> = {};

    if (releaseStatus !== undefined) {
      if (typeof releaseStatus !== "string" || !RELEASE_STATUSES.includes(releaseStatus as ReleaseStatus)) {
        return NextResponse.json({ error: "Invalid releaseStatus" }, { status: 400 });
      }
      updates.releaseStatus = releaseStatus;
    }

    if (publishDate !== undefined) {
      if (publishDate === null) {
        updates.publishDate = null;
      } else if (typeof publishDate === "string" && !isNaN(Date.parse(publishDate))) {
        updates.publishDate = new Date(publishDate);
      } else {
        return NextResponse.json({ error: "Invalid publishDate" }, { status: 400 });
      }
    }

    if (title !== undefined) {
      if (title !== null && typeof title !== "string") {
        return NextResponse.json({ error: "Invalid title" }, { status: 400 });
      }
      updates.title = title === null ? null : title.trim() || null;
    }

    if (lyrics !== undefined) {
      if (lyrics !== null && typeof lyrics !== "string") {
        return NextResponse.json({ error: "Invalid lyrics" }, { status: 400 });
      }
      updates.lyrics = lyrics === null ? null : lyrics.trim() || null;
    }

    if (prompt !== undefined) {
      if (prompt !== null && typeof prompt !== "string") {
        return NextResponse.json({ error: "Invalid prompt" }, { status: 400 });
      }
      updates.prompt = prompt === null ? null : prompt.trim() || null;
    }

    if (notes !== undefined) {
      if (typeof notes !== "string") {
        return NextResponse.json({ error: "Invalid notes" }, { status: 400 });
      }
      updates.notes = notes;
    }

    if (songDna !== undefined) {
      if (songDna !== null && typeof songDna !== "string") {
        return NextResponse.json({ error: "Invalid songDna" }, { status: 400 });
      }
      updates.songDna = songDna === null ? null : songDna.trim() || null;
    }

    if (votingEnabled !== undefined) {
      if (typeof votingEnabled !== "boolean") {
        return NextResponse.json({ error: "Invalid votingEnabled" }, { status: 400 });
      }
      updates.votingEnabled = votingEnabled;
    }

    const [updated] = await db
      .update(songs)
      .set(updates)
      .where(and(eq(songs.id, id), eq(songs.userId, auth.userId)))
      .returning();

    return NextResponse.json({ song: updated });
  } catch (error) {
    console.error("[songs/patch]", error);
    return NextResponse.json({ error: "Failed to update song" }, { status: 500 });
  }
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
