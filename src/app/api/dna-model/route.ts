import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { dnaModels, dnaProfiles, dnaTraits } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { createApimartModel } from "@/lib/providers/apimart";
import { resolveDnaModelAudioUrls } from "@/lib/dna/model-audio";
import { DNA_MODEL_MAX_TRACKS, DNA_MODEL_MIN_TRACKS } from "@/lib/dna/model-spec";

const MAX_NAME_LENGTH = 160;
// Display copy of the traits a model was trained against. The whole profile is
// not worth keeping; these are the numbers the ranking actually used.
const SNAPSHOT_TRAIT_KEYS = ["tempo", "energy", "genres", "atmospheres"];

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const models = await db
    .select()
    .from(dnaModels)
    .where(eq(dnaModels.userId, userId))
    .orderBy(desc(dnaModels.createdAt));

  return NextResponse.json({ models });
}

/**
 * Trains one custom APIMart model from 6–24 of the user's own tracks.
 *
 * The body is only `name` and `trackIds`: the candidates are picked in the
 * browser from /api/dna-model/candidates, and the audio URLs are resolved here
 * so a client can never hand APIMart an arbitrary URL to train on.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Give the model a name" }, { status: 400 });
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: `Name must be at most ${MAX_NAME_LENGTH} characters` }, { status: 400 });
  }

  const trackIds: string[] = Array.isArray(body?.trackIds)
    ? body.trackIds.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  if (trackIds.length < DNA_MODEL_MIN_TRACKS || trackIds.length > DNA_MODEL_MAX_TRACKS) {
    return NextResponse.json(
      { error: `Pick between ${DNA_MODEL_MIN_TRACKS} and ${DNA_MODEL_MAX_TRACKS} tracks` },
      { status: 400 }
    );
  }

  // The DNA snapshot is a nicety: a user without a computed profile can still
  // train a model, they just get no "trained from this profile" record.
  const [profile] = await db.select().from(dnaProfiles).where(eq(dnaProfiles.userId, userId)).limit(1);
  let dnaSnapshot: string | null = null;
  if (profile) {
    const traits = await db
      .select({
        traitKey: dnaTraits.traitKey,
        label: dnaTraits.label,
        valueNumber: dnaTraits.valueNumber,
        valueText: dnaTraits.valueText,
        display: dnaTraits.display,
      })
      .from(dnaTraits)
      .where(and(eq(dnaTraits.profileId, profile.id), eq(dnaTraits.userId, userId)));
    const picked = traits.filter((trait) => SNAPSHOT_TRAIT_KEYS.includes(trait.traitKey));
    dnaSnapshot = JSON.stringify(picked);
  }

  let audioUrls: string[];
  try {
    audioUrls = await resolveDnaModelAudioUrls(userId, trackIds);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not prepare the reference clips" }, { status: 400 });
  }

  let taskId: string;
  try {
    ({ taskId } = await createApimartModel({ name, audioUrls }));
  } catch (error: any) {
    console.error(`[dna-model] createModel failed:`, error?.message ?? error);
    return NextResponse.json(
      { error: error?.message || "APIMart could not start the training" },
      { status: error?.statusCode && error.statusCode < 500 ? error.statusCode : 502 }
    );
  }

  const [model] = await db
    .insert(dnaModels)
    .values({
      userId,
      apimartTaskId: taskId,
      name,
      status: "pending",
      trainingTrackIds: JSON.stringify(trackIds),
      trainingTrackCount: trackIds.length,
      dnaProfileName: profile?.name ?? null,
      dnaProfileComputedAt: profile?.computedAt ?? null,
      trainingDnaSnapshot: dnaSnapshot,
    })
    .returning();

  console.log(`[dna-model] training submitted — id=${model.id} taskId=${taskId} clips=${trackIds.length}`);
  return NextResponse.json({ model });
}
