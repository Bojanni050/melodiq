import { NextResponse } from "next/server";
import { db } from "@/db";
import { tracks, workspaces, playlists, playlistTracks } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  // Fetch all user data in parallel
  const [userTracks, userWorkspaces, userPlaylists] = await Promise.all([
    db.select().from(tracks).where(eq(tracks.userId, userId)),
    db.select().from(workspaces).where(eq(workspaces.userId, userId)),
    db.select().from(playlists).where(eq(playlists.userId, userId)),
  ]);

  // Fetch playlist tracks for all playlists
  let userPlaylistTracks: (typeof playlistTracks.$inferSelect)[] = [];
  if (userPlaylists.length > 0) {
    const playlistIds = userPlaylists.map((p) => p.id);
    userPlaylistTracks = await db
      .select()
      .from(playlistTracks)
      .where(inArray(playlistTracks.playlistId, playlistIds));
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: 1,
    counts: {
      tracks: userTracks.length,
      workspaces: userWorkspaces.length,
      playlists: userPlaylists.length,
      playlistTracks: userPlaylistTracks.length,
    },
    tracks: userTracks.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
    workspaces: userWorkspaces.map((w) => ({
      ...w,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    })),
    playlists: userPlaylists.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    playlistTracks: userPlaylistTracks.map((pt) => ({
      ...pt,
      createdAt: pt.createdAt.toISOString(),
    })),
  };

  const now = new Date().toISOString().slice(0, 10);

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="melodiq-backup-${now}.json"`,
    },
  });
}
