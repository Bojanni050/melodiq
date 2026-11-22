import { NextResponse } from "next/server";
import { db } from "@/db";
import { clonedVoices, tracks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  // The source track title travels with the voice so the settings list can say
  // where a voice came from. A voice from a direct upload has no source track,
  // and a voice whose track was deleted keeps its row with a null title.
  const rows = await db
    .select({
      voice: clonedVoices,
      sourceTrackTitle: tracks.title,
    })
    .from(clonedVoices)
    .leftJoin(tracks, eq(clonedVoices.sourceTrackId, tracks.id))
    .where(eq(clonedVoices.userId, userId))
    .orderBy(desc(clonedVoices.createdAt));

  const voices = rows.map((row) => ({
    ...row.voice,
    sourceTrackTitle: row.sourceTrackTitle,
  }));

  return NextResponse.json({ voices });
}
