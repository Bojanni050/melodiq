import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { addTrackToFavoritesPlaylist, removeTrackFromFavoritesPlaylist } from "@/lib/playlists";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const result = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const previousRating = result[0].rating;

  try {
    const body = await request.json();
    const { rating } = body;

    if (!["up", "down", null].includes(rating)) {
      return NextResponse.json({ error: "Invalid rating value" }, { status: 400 });
    }

    const updated = await db
      .update(tracks)
      .set({ rating })
      .where(and(eq(tracks.id, id), eq(tracks.userId, userId)))
      .returning();

    // "up" (the heart / Favoriet button) keeps the Favorieten system
    // playlist in sync — added when set, removed when un-favorited.
    if (rating === "up" && previousRating !== "up") {
      await addTrackToFavoritesPlaylist(userId, id);
    } else if (rating !== "up" && previousRating === "up") {
      await removeTrackFromFavoritesPlaylist(userId, id);
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("Rating update error:", error);
    return NextResponse.json({ error: "Failed to update rating" }, { status: 500 });
  }
}
