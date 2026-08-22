import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { playlists } from "@/db/schema";
import { ensureFavoritesPlaylist, getUserPlaylistsWithTrackIds } from "@/lib/playlists";
import { requireAuth } from "@/lib/require-auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Guarantees every user has a Favorieten playlist, even with zero
  // favorited tracks so far — Master Tracks only appears once a track is
  // linked, but Favorieten should always be there to receive hearts.
  await ensureFavoritesPlaylist(auth.userId);

  const payload = await getUserPlaylistsWithTrackIds(auth.userId);
  return NextResponse.json({ playlists: payload });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const rawName = typeof body?.name === "string" ? body.name : "";
    const name = rawName.trim();

    if (!name) {
      return NextResponse.json({ error: "Playlist name is required" }, { status: 400 });
    }

    const normalizedName = name.toLowerCase();
    const existing = await db
      .select()
      .from(playlists)
      .where(eq(playlists.userId, auth.userId));

    const existingByName = existing.find(
      (playlist) => playlist.name.trim().toLowerCase() === normalizedName
    );

    if (existingByName) {
      const hydrated = await getUserPlaylistsWithTrackIds(auth.userId);
      const merged = hydrated.find((playlist) => playlist.id === existingByName.id);
      return NextResponse.json({ playlist: merged, merged: true });
    }

    const id = typeof body?.id === "string" && body.id.trim() ? body.id.trim() : randomUUID();

    const inserted = await db
      .insert(playlists)
      .values({
        id,
        userId: auth.userId,
        name,
      })
      .returning();

    if (!inserted[0]) {
      return NextResponse.json({ error: "Failed to create playlist" }, { status: 500 });
    }

    return NextResponse.json({
      playlist: {
        id: inserted[0].id,
        name: inserted[0].name,
        trackIds: [],
        createdAt: inserted[0].createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[playlists/post]", error);
    return NextResponse.json({ error: "Failed to create playlist" }, { status: 500 });
  }
}
