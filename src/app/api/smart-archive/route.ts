import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { tracks, trackStems, trackMasters } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { findDuplicateCandidateGroups } from "@/lib/smart-archive";
import { checkArchiveGuards } from "@/lib/archive-guards";

const SNIPPET_LENGTH = 200;

type GuardedTrack = {
  id: string;
  title: string | null;
  promptSnippet: string | null;
  lyricsSnippet: string | null;
  hasCover: boolean;
  blocked: boolean;
  reasons: { type: string; detail: string }[];
  duration: number | null;
  status: string;
  releaseStatus: string | null;
  publishDate: string | null;
  playCount: number;
  lyricsTimestamps: string | null;
  instrumental: boolean;
  // What archiving this track would delete (mirrors /api/tracks/[id]/archive):
  // HD/WAV version, all stems, all masters. The original mp3 and Track DNA
  // (trackDna/audioDna/advancedDna) are always preserved.
  hasHd: boolean;
  stemsCount: number;
  mastersCount: number;
};

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  try {
    const groups = await findDuplicateCandidateGroups(userId);
    const allTrackIds = Array.from(new Set(groups.flatMap((group) => group.trackIds)));

    if (allTrackIds.length === 0) {
      return NextResponse.json({ groups: [] });
    }

    const [guardEntries, trackRows, stemCounts, masterCounts] = await Promise.all([
      Promise.all(
        allTrackIds.map(async (trackId) => [trackId, await checkArchiveGuards(trackId, userId)] as const)
      ),
      db
        .select({
          id: tracks.id,
          title: tracks.title,
          prompt: tracks.prompt,
          lyrics: tracks.lyrics,
          s3KeyCover: tracks.s3KeyCover,
          duration: tracks.duration,
          status: tracks.status,
          releaseStatus: tracks.releaseStatus,
          publishDate: tracks.publishDate,
          playCount: tracks.playCount,
          lyricsTimestamps: tracks.lyricsTimestamps,
          instrumental: tracks.instrumental,
          s3KeyHd: tracks.s3KeyHd,
        })
        .from(tracks)
        .where(and(inArray(tracks.id, allTrackIds), eq(tracks.userId, userId))),
      db
        .select({ trackId: trackStems.trackId, count: sql<number>`count(*)::int` })
        .from(trackStems)
        .where(inArray(trackStems.trackId, allTrackIds))
        .groupBy(trackStems.trackId),
      db
        .select({ trackId: trackMasters.trackId, count: sql<number>`count(*)::int` })
        .from(trackMasters)
        .where(inArray(trackMasters.trackId, allTrackIds))
        .groupBy(trackMasters.trackId),
    ]);

    const guardById = new Map(guardEntries);
    const trackById = new Map(trackRows.map((row) => [row.id, row]));
    const stemCountById = new Map(stemCounts.map((row) => [row.trackId, row.count]));
    const masterCountById = new Map(masterCounts.map((row) => [row.trackId, row.count]));

    const payload = groups.map((group) => ({
      id: group.id,
      score: group.score,
      matchedOn: group.matchedOn,
      tracks: group.trackIds.map((trackId): GuardedTrack => {
        const track = trackById.get(trackId);
        const guard = guardById.get(trackId);
        return {
          id: trackId,
          title: track?.title ?? null,
          promptSnippet: track?.prompt ? track.prompt.slice(0, SNIPPET_LENGTH) : null,
          lyricsSnippet: track?.lyrics ? track.lyrics.slice(0, SNIPPET_LENGTH) : null,
          hasCover: !!track?.s3KeyCover,
          blocked: guard?.blocked ?? false,
          reasons: guard?.blocked ? [{ type: guard.reason, detail: guard.message }] : [],
          duration: track?.duration ?? null,
          status: track?.status ?? "pending",
          releaseStatus: track?.releaseStatus ?? null,
          publishDate: track?.publishDate ? track.publishDate.toISOString() : null,
          playCount: track?.playCount ?? 0,
          lyricsTimestamps: track?.lyricsTimestamps ?? null,
          instrumental: track?.instrumental ?? false,
          hasHd: !!track?.s3KeyHd,
          stemsCount: stemCountById.get(trackId) ?? 0,
          mastersCount: masterCountById.get(trackId) ?? 0,
        };
      }),
    }));

    return NextResponse.json({ groups: payload });
  } catch (error) {
    console.error("[smart-archive] failed to build duplicate candidate groups", error);
    return NextResponse.json({ error: "Failed to load archive candidates" }, { status: 500 });
  }
}
