import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { tracks } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { findDuplicateCandidateGroups } from "@/lib/smart-archive";
import { checkTracksArchiveGuard, type ArchiveBlockReason } from "@/lib/track-archive-guards";

const SNIPPET_LENGTH = 200;

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const groups = await findDuplicateCandidateGroups(userId);
  const allTrackIds = Array.from(new Set(groups.flatMap((group) => group.trackIds)));

  if (allTrackIds.length === 0) {
    return NextResponse.json({ groups: [] });
  }

  const [guardResults, trackRows] = await Promise.all([
    checkTracksArchiveGuard(allTrackIds, userId),
    db
      .select({
        id: tracks.id,
        title: tracks.title,
        prompt: tracks.prompt,
        lyrics: tracks.lyrics,
        s3KeyCover: tracks.s3KeyCover,
      })
      .from(tracks)
      .where(inArray(tracks.id, allTrackIds)),
  ]);

  const trackById = new Map(trackRows.map((row) => [row.id, row]));

  const payload = groups.map((group) => ({
    id: group.id,
    score: group.score,
    matchedOn: group.matchedOn,
    tracks: group.trackIds.map((trackId) => {
      const track = trackById.get(trackId);
      const guard = guardResults.get(trackId) ?? { blocked: false, reasons: [] as ArchiveBlockReason[] };
      return {
        id: trackId,
        title: track?.title ?? null,
        promptSnippet: track?.prompt ? track.prompt.slice(0, SNIPPET_LENGTH) : null,
        lyricsSnippet: track?.lyrics ? track.lyrics.slice(0, SNIPPET_LENGTH) : null,
        hasCover: !!track?.s3KeyCover,
        blocked: guard.blocked,
        reasons: guard.reasons,
      };
    }),
  }));

  return NextResponse.json({ groups: payload });
}
