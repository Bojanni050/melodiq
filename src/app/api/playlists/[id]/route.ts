import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { playlistTracks, playlists, tracks } from "@/db/schema";
import { getUserPlaylistById, getUserPlaylistsWithTrackIds } from "@/lib/playlists";
import { requireAuth } from "@/lib/require-auth";

function normalizeTrackIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

async function normalizePlaylistOrder(playlistId: string, orderedRows: Array<{ id: string }>) {
  // Phase 1: move current positions away from the target range to avoid unique collisions.
  for (let index = 0; index < orderedRows.length; index += 1) {
    await db
      .update(playlistTracks)
      .set({ position: index + 100000 })
      .where(eq(playlistTracks.id, orderedRows[index].id));
  }

  // Phase 2: assign final contiguous positions.
  for (let index = 0; index < orderedRows.length; index += 1) {
    await db
      .update(playlistTracks)
      .set({ position: index })
      .where(eq(playlistTracks.id, orderedRows[index].id));
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const existing = await getUserPlaylistById(auth.userId, id);
    if (!existing) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }

    await db.delete(playlists).where(and(eq(playlists.id, id), eq(playlists.userId, auth.userId)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[playlists/delete]", error);
    return NextResponse.json({ error: "Failed to delete playlist" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const existing = await getUserPlaylistById(auth.userId, id);
  if (!existing) {
    return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const action = typeof body?.action === "string" ? body.action : "";

    if (action === "add-track") {
      const trackId = typeof body?.trackId === "string" ? body.trackId : "";
      const allowDuplicate = body?.allowDuplicate === true;

      if (!trackId) {
        return NextResponse.json({ error: "trackId is required" }, { status: 400 });
      }

      const track = await db
        .select({ id: tracks.id })
        .from(tracks)
        .where(and(eq(tracks.id, trackId), eq(tracks.userId, auth.userId)))
        .limit(1);

      if (!track[0]) {
        return NextResponse.json({ error: "Track not found" }, { status: 404 });
      }

      if (!allowDuplicate) {
        const existingTrack = await db
          .select({ id: playlistTracks.id })
          .from(playlistTracks)
          .where(and(eq(playlistTracks.playlistId, id), eq(playlistTracks.trackId, trackId)))
          .limit(1);

        if (existingTrack[0]) {
          const hydrated = await getUserPlaylistsWithTrackIds(auth.userId);
          const playlist = hydrated.find((item) => item.id === id);
          return NextResponse.json({ playlist, skipped: true });
        }
      }

      const maxPos = await db
        .select({ value: sql<number>`coalesce(max(${playlistTracks.position}), -1)` })
        .from(playlistTracks)
        .where(eq(playlistTracks.playlistId, id));

      const nextPosition = Number(maxPos[0]?.value ?? -1) + 1;

      await db.insert(playlistTracks).values({
        playlistId: id,
        trackId,
        position: nextPosition,
      });

      const hydrated = await getUserPlaylistsWithTrackIds(auth.userId);
      const playlist = hydrated.find((item) => item.id === id);
      return NextResponse.json({ playlist });
    }

    if (action === "remove-track") {
      const trackId = typeof body?.trackId === "string" ? body.trackId : "";
      if (!trackId) {
        return NextResponse.json({ error: "trackId is required" }, { status: 400 });
      }

      await db
        .delete(playlistTracks)
        .where(and(eq(playlistTracks.playlistId, id), eq(playlistTracks.trackId, trackId)));

      const remaining = await db
        .select({ id: playlistTracks.id })
        .from(playlistTracks)
        .where(eq(playlistTracks.playlistId, id))
        .orderBy(asc(playlistTracks.position), asc(playlistTracks.createdAt));

      await normalizePlaylistOrder(id, remaining);

      const hydrated = await getUserPlaylistsWithTrackIds(auth.userId);
      const playlist = hydrated.find((item) => item.id === id);
      return NextResponse.json({ playlist });
    }

    if (action === "reorder-tracks") {
      const orderedTrackIds = normalizeTrackIds(body?.trackIds);
      console.log("[reorder-tracks] received", orderedTrackIds.length, "trackIds for playlist", id);

      const currentRows = await db
        .select({ id: playlistTracks.id, trackId: playlistTracks.trackId })
        .from(playlistTracks)
        .where(eq(playlistTracks.playlistId, id))
        .orderBy(asc(playlistTracks.position), asc(playlistTracks.createdAt));

      if (currentRows.length === 0) {
        const hydrated = await getUserPlaylistsWithTrackIds(auth.userId);
        const playlist = hydrated.find((item) => item.id === id);
        return NextResponse.json({ playlist });
      }

      const remainingRows = [...currentRows];
      const nextRows: Array<{ id: string; trackId: string }> = [];

      orderedTrackIds.forEach((trackId) => {
        const index = remainingRows.findIndex((row) => row.trackId === trackId);
        if (index < 0) return;
        nextRows.push(remainingRows[index]);
        remainingRows.splice(index, 1);
      });

      nextRows.push(...remainingRows);

      console.log("[reorder-tracks] applying order", nextRows.map(r => r.trackId));
      await normalizePlaylistOrder(id, nextRows);

      const hydrated = await getUserPlaylistsWithTrackIds(auth.userId);
      const playlist = hydrated.find((item) => item.id === id);
      console.log("[reorder-tracks] saved, returning", playlist?.trackIds);
      return NextResponse.json({ playlist });
    }

    if (action === "move-track") {
      // Delta reorder: move one track to a specific index, applied to current DB state.
      // Safe for multi-device: server reads its own current order before applying.
      const trackId = typeof body?.trackId === "string" ? body.trackId : "";
      const toIndex = typeof body?.toIndex === "number" ? body.toIndex : -1;

      if (!trackId || toIndex < 0) {
        return NextResponse.json({ error: "trackId and toIndex are required" }, { status: 400 });
      }

      const currentRows = await db
        .select({ id: playlistTracks.id, trackId: playlistTracks.trackId })
        .from(playlistTracks)
        .where(eq(playlistTracks.playlistId, id))
        .orderBy(asc(playlistTracks.position), asc(playlistTracks.createdAt));

      const fromIndex = currentRows.findIndex((row) => row.trackId === trackId);
      if (fromIndex === -1) {
        return NextResponse.json({ error: "Track not in playlist" }, { status: 404 });
      }

      const reordered = [...currentRows];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(Math.min(toIndex, reordered.length), 0, moved);

      await normalizePlaylistOrder(id, reordered);

      const hydrated = await getUserPlaylistsWithTrackIds(auth.userId);
      const playlist = hydrated.find((item) => item.id === id);
      return NextResponse.json({ playlist });
    }

    if (action === "rename") {
      const rawName = typeof body?.name === "string" ? body.name : "";
      const name = rawName.trim();
      if (!name) {
        return NextResponse.json({ error: "Playlist name is required" }, { status: 400 });
      }

      const duplicates = await db
        .select({ id: playlists.id })
        .from(playlists)
        .where(and(eq(playlists.userId, auth.userId), eq(playlists.name, name)));

      if (duplicates.some((row) => row.id !== id)) {
        return NextResponse.json({ error: "Playlist name already exists" }, { status: 409 });
      }

      await db
        .update(playlists)
        .set({ name, updatedAt: new Date() })
        .where(and(eq(playlists.id, id), eq(playlists.userId, auth.userId)));

      const hydrated = await getUserPlaylistsWithTrackIds(auth.userId);
      const playlist = hydrated.find((item) => item.id === id);
      return NextResponse.json({ playlist });
    }

    if (action === "update-description") {
      const raw = typeof body?.description === "string" ? body.description : "";
      const description = raw.trim().slice(0, 500) || null;

      await db
        .update(playlists)
        .set({ description, updatedAt: new Date() })
        .where(and(eq(playlists.id, id), eq(playlists.userId, auth.userId)));

      const hydrated = await getUserPlaylistsWithTrackIds(auth.userId);
      const playlist = hydrated.find((item) => item.id === id);
      return NextResponse.json({ playlist });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("[playlists/patch]", error);
    return NextResponse.json({ error: "Failed to update playlist" }, { status: 500 });
  }
}
