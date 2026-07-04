import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { translateLyrics } from "@/lib/providers/llm";
import { logApi } from "@/lib/logger";

const MAX_TARGET_LANGUAGE_LENGTH = 50;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { id } = await params;

  const result = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const track = result[0];

  if (!track.language) {
    return NextResponse.json(
      { error: "Set the track's language before translating its lyrics" },
      { status: 400 }
    );
  }

  if (!track.lyrics?.trim()) {
    return NextResponse.json({ error: "Track has no lyrics to translate" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const targetLanguage =
    body && typeof body === "object" && "targetLanguage" in body
      ? (body as { targetLanguage: unknown }).targetLanguage
      : undefined;

  if (typeof targetLanguage !== "string" || !targetLanguage.trim()) {
    return NextResponse.json({ error: "targetLanguage is required" }, { status: 400 });
  }
  if (targetLanguage.length > MAX_TARGET_LANGUAGE_LENGTH) {
    return NextResponse.json({ error: "targetLanguage too long" }, { status: 400 });
  }

  const trimmedTargetLanguage = targetLanguage.trim();
  const startTime = Date.now();

  try {
    const translated = await translateLyrics(track.lyrics, track.language, trimmedTargetLanguage);

    const updated = await db
      .update(tracks)
      .set({
        translatedLyrics: translated,
        translatedLanguage: trimmedTargetLanguage,
      })
      .where(eq(tracks.id, track.id!))
      .returning();

    await logApi({
      userId,
      type: "generation",
      provider: "llm",
      endpoint: "/api/tracks/[id]/translate-lyrics",
      request: JSON.stringify({ trackId: track.id, sourceLanguage: track.language, targetLanguage: trimmedTargetLanguage }),
      response: JSON.stringify({ trackId: track.id, length: translated.length }),
      statusCode: 200,
      duration: Date.now() - startTime,
    });

    return NextResponse.json(updated[0]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[translate-lyrics] failed for track ${track.id}:`, message);
    await logApi({
      userId,
      type: "generation",
      provider: "llm",
      endpoint: "/api/tracks/[id]/translate-lyrics",
      request: JSON.stringify({ trackId: track.id, sourceLanguage: track.language, targetLanguage: trimmedTargetLanguage }),
      response: JSON.stringify({ error: message }),
      statusCode: 500,
      duration: Date.now() - startTime,
    });
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
