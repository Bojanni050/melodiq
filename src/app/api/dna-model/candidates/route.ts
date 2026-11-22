import { NextResponse } from "next/server";
import { and, desc, eq, isNotNull, or } from "drizzle-orm";

import { db } from "@/db";
import { dnaProfiles, dnaTraits, tracks } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import {
  dnaFitTargets,
  rankDnaModelCandidates,
  type DnaFitTrackInput,
} from "@/lib/dna/model-fit";
import {
  DNA_MODEL_MAX_TRACKS,
  DNA_MODEL_MIN_TRACKS,
  DNA_MODEL_SUGGESTED_TRACKS,
} from "@/lib/dna/model-spec";

// Bounded read: a catalogue larger than this still ranks fine, and the dialog
// has no business rendering thousands of rows.
const CANDIDATE_POOL = 200;

/**
 * Suggests which finished tracks should become the reference clips of a new
 * DNA model, ranked by how well each one matches the stored Melody DNA.
 *
 * Nothing is written here and nothing is trained here: the user reviews and
 * corrects the selection, then POSTs it to /api/dna-model.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const [profile] = await db.select().from(dnaProfiles).where(eq(dnaProfiles.userId, userId)).limit(1);
  const traits = profile
    ? await db
        .select({
          traitKey: dnaTraits.traitKey,
          valueNumber: dnaTraits.valueNumber,
          valueText: dnaTraits.valueText,
        })
        .from(dnaTraits)
        .where(and(eq(dnaTraits.profileId, profile.id), eq(dnaTraits.userId, userId)))
    : [];

  const targets = dnaFitTargets(traits);

  const rows = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      createdAt: tracks.createdAt,
      rating: tracks.rating,
      instrumental: tracks.instrumental,
      prompt: tracks.prompt,
      audioDna: tracks.audioDna,
    })
    .from(tracks)
    .where(
      and(
        eq(tracks.userId, userId),
        eq(tracks.status, "done"),
        // APIMart fetches the clips itself, so a track without stored audio
        // cannot be a reference — leave it out instead of failing later.
        or(
          isNotNull(tracks.s3KeyMp3),
          isNotNull(tracks.s3Key),
          isNotNull(tracks.s3KeyHd),
          isNotNull(tracks.s3KeyOgg)
        )
      )
    )
    .orderBy(desc(tracks.createdAt))
    .limit(CANDIDATE_POOL);

  const candidates = rankDnaModelCandidates(rows as DnaFitTrackInput[], targets);

  return NextResponse.json({
    profile: profile
      ? {
          name: profile.name,
          summary: profile.summary,
          computedAt: profile.computedAt,
          sourceCount: profile.sourceCount,
        }
      : null,
    targets,
    candidates,
    // Preselect the best-fitting clips, but never more than the API accepts.
    suggestedIds: candidates.slice(0, DNA_MODEL_SUGGESTED_TRACKS).map((candidate) => candidate.id),
    bounds: {
      min: DNA_MODEL_MIN_TRACKS,
      max: DNA_MODEL_MAX_TRACKS,
      suggested: DNA_MODEL_SUGGESTED_TRACKS,
    },
  });
}
