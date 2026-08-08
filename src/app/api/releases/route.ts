import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { releases } from "@/db/schema";
import { getUserReleasesWithTracks } from "@/lib/releases";
import { requireAuth } from "@/lib/require-auth";

const RELEASE_TYPES = new Set(["single", "ep", "album"]);

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const payload = await getUserReleasesWithTracks(auth.userId);
  return NextResponse.json({ releases: payload });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const rawTitle = typeof body?.title === "string" ? body.title : "";
    const title = rawTitle.trim();
    const type = typeof body?.type === "string" ? body.type : "";
    const kind = typeof body?.kind === "string" && body.kind.trim() ? body.kind.trim() : null;
    const artistName = typeof body?.artistName === "string" && body.artistName.trim() ? body.artistName.trim() : null;

    if (!title) {
      return NextResponse.json({ error: "Release title is required" }, { status: 400 });
    }
    if (!RELEASE_TYPES.has(type)) {
      return NextResponse.json({ error: "type must be single, ep, or album" }, { status: 400 });
    }

    const inserted = await db
      .insert(releases)
      .values({ userId: auth.userId, title, type, kind, artistName })
      .returning();

    if (!inserted[0]) {
      return NextResponse.json({ error: "Failed to create release" }, { status: 500 });
    }

    return NextResponse.json({
      release: {
        id: inserted[0].id,
        title: inserted[0].title,
        type: inserted[0].type,
        kind: inserted[0].kind,
        artistName: inserted[0].artistName,
        description: inserted[0].description,
        coverUrl: null,
        releaseDate: inserted[0].releaseDate?.toISOString() ?? null,
        isPublic: inserted[0].isPublic,
        publishedAt: null,
        createdAt: inserted[0].createdAt.toISOString(),
        updatedAt: inserted[0].updatedAt.toISOString(),
        tracks: [],
      },
    });
  } catch (error) {
    console.error("[releases/post]", error);
    return NextResponse.json({ error: "Failed to create release" }, { status: 500 });
  }
}
