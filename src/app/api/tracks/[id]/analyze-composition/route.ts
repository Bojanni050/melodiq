import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { analyzeTrackDna } from "@/lib/track-dna-analysis";
import { logToFile } from "@/lib/file-logger";

const LOG_FILE = "track-dna.log";
function log(message: string): void {
  console.info(message);
  logToFile(LOG_FILE, message);
}
function warn(message: string): void {
  console.warn(message);
  logToFile(LOG_FILE, message);
}

// On-demand version of the "Composition" Track DNA signal — lets the user
// trigger it for a specific track regardless of the AUTO_ANALYZE_COMPOSITION
// setting, instead of only ever running automatically on new generations.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { id } = await params;

  const result = await db
    .select({ id: tracks.id, status: tracks.status })
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const track = result[0];
  if (track.status !== "done") {
    return NextResponse.json({ error: "Track isn't ready yet" }, { status: 400 });
  }

  log(`[analyze-composition] track ${id}: starting on-demand composition analysis (userId=${userId})`);
  const audioDna = await analyzeTrackDna(id);
  if (!audioDna) {
    warn(`[analyze-composition] track ${id}: analyzeTrackDna returned null — see [track-dna-analysis]/[llm][composition] logs above for the reason`);
    return NextResponse.json({ error: "Composition analysis failed" }, { status: 502 });
  }

  log(`[analyze-composition] track ${id}: done, compositionScore=${audioDna.compositionScore}`);
  return NextResponse.json({ audioDna });
}
