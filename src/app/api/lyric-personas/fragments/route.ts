import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { savedLyrics, songArchive, tracks } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { extractPromotedFragments, pickRandomFragments } from "@/lib/lyric-persona-fragments";
import { normalizeFragmentText, type LyricPersonaFragment } from "@/lib/lyric-personas";

export const dynamic = "force-dynamic";

const MAX_SOURCES = 200;
const MAX_EXTRA_SOURCES = 100;
const MAX_LYRICS_LENGTH = 50_000;

interface LyricSource {
  title: string;
  lyrics: string;
}

function isExtraLyric(value: unknown): value is LyricSource {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.lyrics === "string";
}

/**
 * Serves a fresh batch of persona material. The pool is the user's whole lyric
 * archive — saved lyrics, song archive and generated tracks — plus snapshots the
 * page keeps in localStorage. Selection happens here so the client never has to
 * receive every lyric it owns.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const excludeIds = Array.isArray(body?.excludeIds)
    ? body.excludeIds.filter((id: unknown): id is string => typeof id === "string").slice(0, 100)
    : [];
  const limit = typeof body?.limit === "number" && Number.isFinite(body.limit)
    ? Math.max(1, Math.min(40, Math.round(body.limit)))
    : 24;
  const extraLyrics = Array.isArray(body?.extraLyrics)
    ? body.extraLyrics.filter(isExtraLyric).slice(0, MAX_EXTRA_SOURCES)
    : [];

  const [savedRows, archiveRows, trackRows] = await Promise.all([
    db
      .select({ title: savedLyrics.title, lyrics: savedLyrics.lyrics })
      .from(savedLyrics)
      .where(eq(savedLyrics.userId, auth.userId))
      .orderBy(desc(savedLyrics.createdAt))
      .limit(MAX_SOURCES),
    db
      .select({ title: songArchive.title, lyrics: songArchive.lyrics })
      .from(songArchive)
      .where(eq(songArchive.userId, auth.userId))
      .orderBy(desc(songArchive.updatedAt))
      .limit(MAX_SOURCES),
    db
      .select({ title: tracks.title, lyrics: tracks.lyrics })
      .from(tracks)
      .where(and(eq(tracks.userId, auth.userId), isNotNull(tracks.lyrics)))
      .orderBy(desc(tracks.createdAt))
      .limit(MAX_SOURCES),
  ]);

  const sources: LyricSource[] = [
    ...savedRows,
    ...archiveRows,
    ...trackRows.map((row) => ({ title: row.title, lyrics: row.lyrics || "" })),
    ...extraLyrics.map((item: LyricSource) => ({
      title: typeof item.title === "string" ? item.title.slice(0, 255) : "",
      lyrics: item.lyrics.slice(0, MAX_LYRICS_LENGTH),
    })),
  ];

  const seen = new Set<string>();
  const candidates: LyricPersonaFragment[] = [];
  let sourceCount = 0;

  for (const source of sources) {
    const normalized = normalizeFragmentText(source.lyrics);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    sourceCount++;
    candidates.push(...extractPromotedFragments(normalized, source.title));
  }

  const fragments = pickRandomFragments(candidates, { limit, excludeIds });
  return NextResponse.json({ fragments, sourceCount });
}
