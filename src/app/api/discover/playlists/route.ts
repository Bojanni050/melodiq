import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { playlistTracks, playlists, tracks } from "@/db/schema";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select({
      id: playlists.id,
      name: playlists.name,
      description: playlists.description,
      trackCount: sql<number>`count(distinct ${playlistTracks.id})::int`,
      hasCover: sql<boolean>`(${playlists.s3KeyCover} is not null) or bool_or(${tracks.s3KeyCover} is not null)`,
    })
    .from(playlists)
    .leftJoin(playlistTracks, eq(playlistTracks.playlistId, playlists.id))
    .leftJoin(tracks, eq(tracks.id, playlistTracks.trackId))
    .where(and(eq(playlists.isPublic, true), eq(playlists.isSystem, false)))
    .groupBy(playlists.id, playlists.name, playlists.description, playlists.publishedAt, playlists.discoverOrder, playlists.s3KeyCover)
    .orderBy(sql`${playlists.discoverOrder} asc nulls last`, desc(playlists.publishedAt));

  return NextResponse.json({
    playlists: rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      trackCount: row.trackCount,
      coverUrl: row.hasCover ? `/api/discover/playlists/${row.id}/cover` : null,
    })),
  });
}

// Admin-only: reorder ({ action: "reorder", ids }) or unpublish ({ action: "unpublish", id })
// playlists on the public Discover page.
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);

  if (body?.action === "reorder") {
    const ids: unknown = body.ids;
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
      return NextResponse.json({ error: "ids must be a string array" }, { status: 400 });
    }
    await db.transaction(async (tx) => {
      for (const [index, id] of (ids as string[]).entries()) {
        await tx
          .update(playlists)
          .set({ discoverOrder: index })
          .where(and(eq(playlists.id, id), eq(playlists.isPublic, true)));
      }
    });
    return NextResponse.json({ ok: true });
  }

  if (body?.action === "unpublish") {
    if (typeof body.id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await db
      .update(playlists)
      .set({ isPublic: false, publishedAt: null, discoverOrder: null, updatedAt: new Date() })
      .where(eq(playlists.id, body.id));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
