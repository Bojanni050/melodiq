import { and, desc, eq, isNotNull, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { dnaCalibrationAnswers, dnaFeedbackEvents, dnaProfiles, dnaTraits, tracks } from "@/db/schema";
import type { AudioDna } from "@/lib/songs";

import { buildDnaProfile } from "./aggregate";
import {
  CALIBRATION_MAX_CANDIDATES,
  CALIBRATION_TOTAL,
  type CalibrationAnswered,
  type CalibrationCandidate,
} from "./calibration";
import { foldFeedback, type DnaFeedbackEvent, type DnaFeedbackKind, type DnaFeedbackStance } from "./feedback";
import type { AdvancedDnaSummary, DnaBuildResult, DnaCategory, DnaSourceTrack } from "./types";

/**
 * Persistence for Melody DNA.
 *
 * The aggregator is pure; this module is the only place that touches the
 * database. Recompute is a full replace inside one transaction: upsert the
 * single profile row, delete its traits, insert the fresh ones. That keeps the
 * profile and its traits consistent even if two requests race, and it makes the
 * operation idempotent — same catalogue in, same traits out.
 */

/**
 * Bounds one recompute.
 *
 * The sample is pseudo-random, not the newest tracks: recency says more about
 * what someone generated last week than about what their sound is. The order is
 * a hash of the track id, so the same catalogue always yields the same sample —
 * a rebuild must not quietly produce different numbers.
 */
const MAX_SOURCE_TRACKS = 1500;

/**
 * Variants of one song share a title and would otherwise flood the sample
 * ("Rooftop", "Rooftop" — take twelve). Titles are compared trimmed and
 * case-insensitively; tracks without a title are never grouped.
 */
const MAX_TRACKS_PER_TITLE = 12;

function parseAudioDna(raw: string | null): AudioDna | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AudioDna;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function readScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseAdvancedDna(raw: string | null): AdvancedDnaSummary | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      compositionScore: readScore(parsed.compositionScore),
      vocalScore: readScore(parsed.vocalScore),
      productionScore: readScore(parsed.productionScore),
      overallScore: readScore(parsed.overallScore),
    };
  } catch {
    return null;
  }
}

/** Finished, visible tracks only — drafts and deleted tracks say nothing about taste. */
export async function loadDnaSources(userId: string): Promise<DnaSourceTrack[]> {
  // Rank inside each normalised title group first, so the per-title cap is
  // applied before the catalogue sample is drawn. Without the cap a dozen
  // variants of one song decide the whole profile.
  const ranked = db.$with("ranked_dna_tracks").as(
    db
      .select({
        id: tracks.id,
        createdAt: tracks.createdAt,
        duration: tracks.duration,
        prompt: tracks.prompt,
        lyrics: tracks.lyrics,
        language: tracks.language,
        instrumental: tracks.instrumental,
        vocalGender: tracks.vocalGender,
        rating: tracks.rating,
        playCount: tracks.playCount,
        archivedAt: tracks.archivedAt,
        hiddenAt: tracks.hiddenAt,
        audioDna: tracks.audioDna,
        advancedDna: tracks.advancedDna,
        titleRank: sql<number>`row_number() over (
          partition by case
            when coalesce(btrim(${tracks.title}), '') = '' then ${tracks.id}::text
            else lower(btrim(${tracks.title}))
          end
          order by md5(${tracks.id}::text)
        )`.as("title_rank"),
      })
      .from(tracks)
      .where(and(eq(tracks.userId, userId), eq(tracks.status, "done"), isNull(tracks.deletedAt)))
  );

  const rows = await db
    .with(ranked)
    .select({
      id: ranked.id,
      createdAt: ranked.createdAt,
      duration: ranked.duration,
      prompt: ranked.prompt,
      lyrics: ranked.lyrics,
      language: ranked.language,
      instrumental: ranked.instrumental,
      vocalGender: ranked.vocalGender,
      rating: ranked.rating,
      playCount: ranked.playCount,
      archivedAt: ranked.archivedAt,
      hiddenAt: ranked.hiddenAt,
      audioDna: ranked.audioDna,
      advancedDna: ranked.advancedDna,
    })
    .from(ranked)
    .where(lte(ranked.titleRank, MAX_TRACKS_PER_TITLE))
    .orderBy(sql`md5(${ranked.id}::text)`)
    .limit(MAX_SOURCE_TRACKS);

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt ?? null,
    duration: row.duration ?? null,
    prompt: row.prompt ?? null,
    lyrics: row.lyrics ?? null,
    language: row.language ?? null,
    instrumental: Boolean(row.instrumental),
    vocalGender: row.vocalGender ?? null,
    rating: row.rating ?? null,
    playCount: row.playCount ?? 0,
    archivedAt: row.archivedAt ?? null,
    hiddenAt: row.hiddenAt ?? null,
    audioDna: parseAudioDna(row.audioDna ?? null),
    advancedDna: parseAdvancedDna(row.advancedDna ?? null),
  }));
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export type DnaProfileRow = typeof dnaProfiles.$inferSelect;
export type DnaTraitRow = typeof dnaTraits.$inferSelect;

export type StoredDnaProfile = {
  profile: DnaProfileRow;
  traits: DnaTraitRow[];
  /**
   * Current correction per trait. Kept out of the trait rows on purpose: the
   * snapshot is measurement, this is the user talking back. Presenting applies
   * it (see present.ts), so a stored trait always holds its raw confidence.
   */
  feedback: Map<string, DnaFeedbackStance>;
};

/**
 * Newest events first, capped. A user has at most a handful of traits and
 * corrections are rare clicks, so this is generous; the cap only protects
 * against a pathological loop of repeated clicks.
 */
const MAX_FEEDBACK_EVENTS = 500;

export async function loadDnaFeedback(userId: string): Promise<Map<string, DnaFeedbackStance>> {
  const rows = await db
    .select({
      traitKey: dnaFeedbackEvents.traitKey,
      category: dnaFeedbackEvents.category,
      kind: dnaFeedbackEvents.kind,
      createdAt: dnaFeedbackEvents.createdAt,
    })
    .from(dnaFeedbackEvents)
    .where(eq(dnaFeedbackEvents.userId, userId))
    .orderBy(desc(dnaFeedbackEvents.createdAt))
    .limit(MAX_FEEDBACK_EVENTS);

  // foldFeedback sorts chronologically itself; the query order only decides
  // which events survive the cap.
  return foldFeedback(
    rows.map(
      (row): DnaFeedbackEvent => ({
        traitKey: row.traitKey,
        category: row.category,
        kind: row.kind as DnaFeedbackKind,
        createdAt: row.createdAt,
      }),
    ),
  );
}

/**
 * Records one correction. Returns false when the trait is not part of the
 * current snapshot — the UI can only correct what it has seen, so an unknown
 * key means a stale page rather than a new trait.
 */
export async function recordDnaFeedback(
  userId: string,
  traitKey: string,
  kind: DnaFeedbackKind,
): Promise<boolean> {
  const [trait] = await db
    .select({ category: dnaTraits.category })
    .from(dnaTraits)
    .where(and(eq(dnaTraits.userId, userId), eq(dnaTraits.traitKey, traitKey)))
    .limit(1);

  if (!trait) return false;

  await db.insert(dnaFeedbackEvents).values({ userId, traitKey, category: trait.category, kind });
  return true;
}

/** Tracks with audio and a measured tempo/energy: the only ones a duel can use. */
export async function loadCalibrationCandidates(userId: string): Promise<CalibrationCandidate[]> {
  // Released tracks sort first so the candidate cap can never push them out in
  // favour of newer drafts; the picker then prioritises them (calibration.ts).
  const released = sql<boolean>`exists (
    select 1 from release_tracks rt
    join releases r on r.id = rt.release_id
    where rt.track_id = ${tracks.id} and r.user_id = ${userId}
  )`;

  const rows = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      prompt: tracks.prompt,
      audioUrl: tracks.audioUrl,
      duration: tracks.duration,
      audioDna: tracks.audioDna,
      released,
    })
    .from(tracks)
    .where(
      and(
        eq(tracks.userId, userId),
        eq(tracks.status, "done"),
        isNull(tracks.deletedAt),
        isNull(tracks.hiddenAt),
        isNotNull(tracks.audioUrl),
      ),
    )
    .orderBy(desc(released), desc(tracks.createdAt))
    .limit(CALIBRATION_MAX_CANDIDATES);

  const candidates: CalibrationCandidate[] = [];
  for (const row of rows) {
    if (!row.audioUrl) continue;
    const dna = parseAudioDna(row.audioDna ?? null);
    candidates.push({
      id: row.id,
      title: row.title ?? null,
      prompt: row.prompt ?? null,
      audioUrl: row.audioUrl,
      duration: row.duration ?? null,
      tempo: dna?.tempo ?? null,
      energy: dna?.energy ?? null,
      released: Boolean(row.released),
    });
  }
  return candidates;
}

export async function loadCalibrationAnswers(userId: string): Promise<CalibrationAnswered[]> {
  const rows = await db
    .select({
      traitKey: dnaCalibrationAnswers.traitKey,
      trackAId: dnaCalibrationAnswers.trackAId,
      trackBId: dnaCalibrationAnswers.trackBId,
    })
    .from(dnaCalibrationAnswers)
    .where(eq(dnaCalibrationAnswers.userId, userId))
    .orderBy(desc(dnaCalibrationAnswers.createdAt))
    .limit(CALIBRATION_TOTAL * 10);
  return rows;
}

/**
 * Stores one duel and its verdict together. The pair row and the feedback event
 * go in one transaction so a failed event never leaves a pair marked as asked.
 * Returns false when the trait is not in the current snapshot.
 */
export async function recordCalibrationAnswer(
  userId: string,
  input: { traitKey: string; trackAId: string; trackBId: string; choice: "a" | "b" | "neither"; kind: DnaFeedbackKind },
): Promise<boolean> {
  const [trait] = await db
    .select({ category: dnaTraits.category })
    .from(dnaTraits)
    .where(and(eq(dnaTraits.userId, userId), eq(dnaTraits.traitKey, input.traitKey)))
    .limit(1);
  if (!trait) return false;

  await db.transaction(async (tx) => {
    await tx.insert(dnaCalibrationAnswers).values({
      userId,
      traitKey: input.traitKey,
      trackAId: input.trackAId,
      trackBId: input.trackBId,
      choice: input.choice,
    });
    await tx
      .insert(dnaFeedbackEvents)
      .values({ userId, traitKey: input.traitKey, category: trait.category, kind: input.kind });
  });
  return true;
}

const CATEGORY_ORDER: DnaCategory[] = ["sound", "voice", "structure", "words", "taste"];

function sortTraits(rows: DnaTraitRow[]): DnaTraitRow[] {
  return [...rows].sort((a, b) => {
    const categoryDelta =
      CATEGORY_ORDER.indexOf(a.category as DnaCategory) - CATEGORY_ORDER.indexOf(b.category as DnaCategory);
    if (categoryDelta !== 0) return categoryDelta;
    return b.confidence - a.confidence;
  });
}

/** The current snapshot, or null when the user never built one. */
export async function getDnaProfile(userId: string): Promise<StoredDnaProfile | null> {
  const [profile] = await db
    .select()
    .from(dnaProfiles)
    .where(eq(dnaProfiles.userId, userId))
    .limit(1);

  if (!profile) return null;

  const rows = await db.select().from(dnaTraits).where(eq(dnaTraits.profileId, profile.id));
  const feedback = await loadDnaFeedback(userId);

  return { profile, traits: sortTraits(rows), feedback };
}

export type RecomputeResult = StoredDnaProfile & { built: DnaBuildResult };

/**
 * Rebuilds the user's profile from their current catalogue and stores it.
 * Returns the stored rows plus the intermediate build result, which the route
 * does not need but tests and later phases (change explanation) do.
 */
export async function recomputeDnaProfile(
  userId: string,
  options: { now?: Date } = {},
): Promise<RecomputeResult> {
  const sources = await loadDnaSources(userId);
  const built = buildDnaProfile(sources, options);
  const now = options.now ?? new Date();

  const result = await db.transaction(async (tx) => {
    const [profile] = await tx
      .insert(dnaProfiles)
      .values({
        userId,
        name: truncate(built.profile.name, 160),
        summary: built.profile.summary,
        sourceCount: built.profile.sourceCount,
        ratedCount: built.profile.ratedCount,
        likedCount: built.profile.likedCount,
        dislikedCount: built.profile.dislikedCount,
        computedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: dnaProfiles.userId,
        set: {
          name: truncate(built.profile.name, 160),
          summary: built.profile.summary,
          sourceCount: built.profile.sourceCount,
          ratedCount: built.profile.ratedCount,
          likedCount: built.profile.likedCount,
          dislikedCount: built.profile.dislikedCount,
          computedAt: now,
          updatedAt: now,
        },
      })
      .returning();

    // Wholesale replace: a trait that no longer has evidence must disappear
    // instead of lingering with a stale value.
    await tx.delete(dnaTraits).where(eq(dnaTraits.profileId, profile.id));

    let inserted: DnaTraitRow[] = [];
    if (built.traits.length > 0) {
      inserted = await tx
        .insert(dnaTraits)
        .values(
          built.traits.map((trait) => ({
            profileId: profile.id,
            userId,
            category: trait.category,
            traitKey: trait.key,
            label: truncate(trait.label, 160),
            kind: trait.kind,
            valueNumber: trait.valueNumber,
            valueText: trait.valueText,
            unit: trait.unit,
            display: trait.display ? truncate(trait.display, 255) : null,
            confidence: trait.confidence,
            sourceCount: trait.sourceCount,
            weight: trait.weight,
            updatedAt: now,
          })),
        )
        .returning();
    }

    return { profile, traits: sortTraits(inserted) };
  });

  const feedback = await loadDnaFeedback(userId);

  return { ...result, feedback, built };
}
