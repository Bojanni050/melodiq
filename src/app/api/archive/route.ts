import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { songArchive, tracks } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select({
      id: songArchive.id,
      parentId: songArchive.parentId,
      language: songArchive.language,
      title: songArchive.title,
      lyrics: songArchive.lyrics,
      prompt: songArchive.prompt,
      notes: songArchive.notes,
      trackId: songArchive.trackId,
      trackTitle: tracks.title,
      trackCoverUrl: tracks.coverUrl,
      trackS3KeyCoverThumb: tracks.s3KeyCoverThumb,
      createdAt: songArchive.createdAt,
      updatedAt: songArchive.updatedAt,
    })
    .from(songArchive)
    .leftJoin(tracks, eq(songArchive.trackId, tracks.id))
    .where(eq(songArchive.userId, auth.userId))
    .orderBy(desc(songArchive.updatedAt));

  const serialized = rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  const originals = serialized.filter((r) => !r.parentId);
  const translations = serialized.filter((r) => r.parentId);

  return NextResponse.json({
    entries: originals.map((entry) => ({
      ...entry,
      translations: translations.filter((t) => t.parentId === entry.id),
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const lyrics = typeof body?.lyrics === "string" ? body.lyrics.trim() : "";
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  const trackId = typeof body?.trackId === "string" && body.trackId ? body.trackId : null;
  const parentId = typeof body?.parentId === "string" && body.parentId ? body.parentId : null;
  const language = typeof body?.language === "string" && body.language.trim() ? body.language.trim() : null;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

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

  if (parentId) {
    const parentOwned = await db
      .select({ id: songArchive.id })
      .from(songArchive)
      .where(and(eq(songArchive.id, parentId), eq(songArchive.userId, auth.userId)))
      .limit(1);
    if (parentOwned.length === 0) {
      return NextResponse.json({ error: "Parent entry not found" }, { status: 400 });
    }
  }

  const inserted = await db
    .insert(songArchive)
    .values({ userId: auth.userId, title, lyrics, prompt, notes, trackId, parentId, language })
    .returning();

  const row = inserted[0];
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
      trackTitle: null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      translations: [],
    },
  });
}
