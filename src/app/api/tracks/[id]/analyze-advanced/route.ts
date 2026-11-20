import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { analyzeAdvancedDna } from "@/lib/advanced-dna-analysis";

/**
 * Cheap read of the stored analysis, used by the DNA panel the moment it is
 * expanded. Deliberately not GET /api/tracks/[id]: that one presigns every
 * audio URL and can run self-healing provider calls, which made the panel sit
 * on its empty state long enough for the user to think nothing was stored and
 * press "Run analysis" instead.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { id } = await params;

  const result = await db
    .select({ advancedDna: tracks.advancedDna })
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  let analysis: unknown = null;
  const stored = result[0].advancedDna;
  if (stored) {
    try {
      analysis = JSON.parse(stored);
    } catch {
      // A damaged row should read as "no analysis yet", not break the panel.
      analysis = null;
    }
  }

  return NextResponse.json(
    { trackId: id, hasAdvancedDna: analysis !== null, analysis },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { id } = await params;

  const result = await db
    .select({ id: tracks.id, status: tracks.status, s3Key: tracks.s3Key, s3KeyMp3: tracks.s3KeyMp3 })
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const track = result[0];
  if (track.status !== "done" || (!track.s3Key && !track.s3KeyMp3)) {
    return NextResponse.json({ error: "Track audio isn't available yet" }, { status: 400 });
  }

  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "true";

  const analysis = await analyzeAdvancedDna(id, { forceRefresh });
  if (!analysis) {
    return NextResponse.json({ error: "Advanced analysis failed" }, { status: 502 });
  }

  return NextResponse.json({ trackId: id, ...analysis });
}