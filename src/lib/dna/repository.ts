import { and, desc, eq, isNotNull, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  clonedVoices,
  dnaCalibrationAnswers,
  dnaFeedbackEvents,
  dnaProfiles,
  dnaTraitHistory,
  dnaTraits,
  tracks,
} from "@/db/schema";
import type { AudioDna } from "@/lib/songs";

import { buildWritingDna, collectWritingSources } from "@/lib/style-dna/aggregate";

import { buildDnaProfile, sourceWeight } from "./aggregate";
import {
  CALIBRATION_MAX_CANDIDATES,
  CALIBRATION_TOTAL,
  type CalibrationAnswered,
  type CalibrationCandidate,
} from "./calibration";
import { foldFeedback, type DnaFeedbackEvent, type DnaFeedbackKind, type DnaFeedbackStance } from "./feedback";
import { applyLocks, diffTraits, stampTimeline, type TraitSnapshot } from "./history";
import { profileSignals, type ProfileSignals } from "./states";
import type {
  AdvancedDnaSummary,
  DnaBuildResult,
  DnaCategory,
  DnaSourceTrack,
  DnaVoiceProfile,
} from "./types";

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
        provider: tracks.provider,
        lyrics: tracks.lyrics,
        language: tracks.language,
        instrumental: tracks.instrumental,
        ownVoice: tracks.ownVoice,
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
      provider: ranked.provider,
      lyrics: ranked.lyrics,
      language: ranked.language,
      instrumental: ranked.instrumental,
      ownVoice: ranked.ownVoice,
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
    provider: row.provider,
    lyrics: row.lyrics ?? null,
    language: row.language ?? null,
    instrumental: Boolean(row.instrumental),
    ownVoice: row.ownVoice ?? null,
    vocalGender: row.vocalGender ?? null,
    rating: row.rating ?? null,
    playCount: row.playCount ?? 0,
    archivedAt: row.archivedAt ?? null,
    hiddenAt: row.hiddenAt ?? null,
    audioDna: parseAudioDna(row.audioDna ?? null),
    advancedDna: parseAdvancedDna(row.advancedDna ?? null),
  }));
}

/**
 * The voice-clone library, as far as the DNA profile cares: finished clones and
 * which one the Studio currently sends. Null when no clone ever finished, so
 * the trait is absent rather than reporting a borrowed voice as "own".
 */
export async function loadDnaVoiceProfile(userId: string): Promise<DnaVoiceProfile | null> {
  const rows = await db
    .select({ name: clonedVoices.name, isSelected: clonedVoices.isSelected })
    .from(clonedVoices)
    .where(and(eq(clonedVoices.userId, userId), eq(clonedVoices.status, "completed")));

  if (rows.length === 0) return null;

  // The Studio falls back to the first ready voice when nothing is explicitly
  // selected, so the trait reports that voice rather than claiming there is none.
  const selected = rows.find((row) => row.isSelected) ?? rows[0];
  return {
    voiceCount: rows.length,
    selectedName: selected.name?.trim() || null,
  };
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export type DnaProfileRow = typeof dnaProfiles.$inferSelect;
export type DnaTraitRow = typeof dnaTraits.$inferSelect;

export type DnaTraitHistoryRow = typeof dnaTraitHistory.$inferSelect;

export type StoredDnaProfile = {
  profile: DnaProfileRow;
  traits: DnaTraitRow[];
  /**
   * Current correction per trait. Kept out of the trait rows on purpose: the
   * snapshot is measurement, this is the user talking back. Presenting applies
   * it (see present.ts), so a stored trait always holds its raw confidence.
   */
  feedback: Map<string, DnaFeedbackStance>;
  /**
   * Recent changes, newest first. The snapshot says what a trait is; this says
   * how it got there, which is what the "changed this week" state and the trend
   * arrow are read from. Bounded on read and on write (see MAX_HISTORY_*).
   */
  history: DnaTraitHistoryRow[];
  /** The counters above the trait list: songs, edits, calibrations. */
  signals: ProfileSignals;
};

/** Kept per trait; a trait that changes weekly keeps a year of context. */
const MAX_HISTORY_PER_TRAIT = 50;

/** Cap on what one read returns; the page only shows the recent tail anyway. */
const MAX_HISTORY_ROWS = 400;

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

/** Recent changes for one profile, newest first. */
export async function loadDnaHistory(
  profileId: string,
  limit: number = MAX_HISTORY_ROWS,
): Promise<DnaTraitHistoryRow[]> {
  return db
    .select()
    .from(dnaTraitHistory)
    .where(eq(dnaTraitHistory.profileId, profileId))
    .orderBy(desc(dnaTraitHistory.changedAt))
    .limit(limit);
}

/**
 * The three counters the profile header shows. Reads the raw event kinds rather
 * than the folded stance, because "how often did the user correct something" is
 * a count of clicks and not of current opinions.
 */
async function loadDnaSignals(userId: string, sourceCount: number): Promise<ProfileSignals> {
  const [kinds, calibrations] = await Promise.all([
    db
      .select({ kind: dnaFeedbackEvents.kind })
      .from(dnaFeedbackEvents)
      .where(eq(dnaFeedbackEvents.userId, userId))
      .orderBy(desc(dnaFeedbackEvents.createdAt))
      .limit(MAX_FEEDBACK_EVENTS),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(dnaCalibrationAnswers)
      .where(eq(dnaCalibrationAnswers.userId, userId)),
  ]);

  return profileSignals({
    sourceCount,
    feedbackKinds: kinds.map((row) => row.kind),
    calibrationAnswers: calibrations[0]?.count ?? 0,
  });
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
  const [feedback, history, signals] = await Promise.all([
    loadDnaFeedback(userId),
    loadDnaHistory(profile.id),
    loadDnaSignals(userId, profile.sourceCount),
  ]);

  return { profile, traits: sortTraits(rows), feedback, history, signals };
}

/**
 * Pins or unpins one trait. A pinned trait is left alone by the next recompute
 * (see applyLocks), which is how a deliberate correction survives the build.
 * Returns false when the key is not in the current snapshot.
 */
export async function setTraitLock(
  userId: string,
  traitKey: string,
  locked: boolean,
  options: { now?: Date } = {},
): Promise<boolean> {
  const updated = await db
    .update(dnaTraits)
    .set({ lockedAt: locked ? options.now ?? new Date() : null })
    .where(and(eq(dnaTraits.userId, userId), eq(dnaTraits.traitKey, traitKey)))
    .returning({ id: dnaTraits.id });

  return updated.length > 0;
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
  const [sources, voice] = await Promise.all([
    loadDnaSources(userId),
    loadDnaVoiceProfile(userId),
  ]);
  const now = options.now ?? new Date();
  const audioBuilt = buildDnaProfile(sources, { ...options, voice });

  // The writing traits are derived from the same sample, with the same
  // recency/rating weighting, so a rebuild stays deterministic and both halves of
  // the profile move together. `built.traits` is the full set the caller stores.
  const writing = buildWritingDna(
    collectWritingSources(
      sources.map((track) => ({
        lyrics: track.lyrics,
        language: track.language,
        weight: sourceWeight(track, now),
      })),
    ),
  );
  const built = {
    ...audioBuilt,
    traits: [
      ...audioBuilt.traits,
      ...writing.overall,
      ...writing.structure,
      ...writing.byLanguage.flatMap((entry) => entry.traits),
    ],
  };

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

    // The previous snapshot is read before the wholesale replace: it is the only
    // source of "what did this trait say last time", which the history, the locks
    // and the timestamps all depend on.
    const previousRows = await tx.select().from(dnaTraits).where(eq(dnaTraits.profileId, profile.id));
    const previous = previousRows.map(rowToSnapshot);

    const next: TraitSnapshot[] = built.traits.map((trait) => ({
      traitKey: trait.key,
      category: trait.category,
      kind: trait.kind,
      valueNumber: trait.valueNumber,
      valueText: trait.valueText,
      display: trait.display,
      confidence: trait.confidence,
      sourceCount: trait.sourceCount,
      weight: trait.weight,
      firstSeenAt: now,
      lastChangedAt: now,
      lockedAt: null,
    }));

    const stored = stampTimeline(previous, applyLocks(previous, next), { now });
    // Diffed after locking and stamping, so a pinned trait that did not move can
    // never show up as a change.
    const changes = diffTraits(previous, stored);

    await tx.delete(dnaTraits).where(eq(dnaTraits.profileId, profile.id));

    // Labels and units come from whichever side knows them: the fresh build, or
    // the pinned row the build no longer produces.
    const meta = new Map<string, { label: string; unit: string | null }>();
    for (const trait of built.traits) {
      meta.set(trait.key, { label: truncate(trait.label, 160), unit: trait.unit ?? null });
    }
    for (const row of previousRows) {
      if (!meta.has(row.traitKey)) meta.set(row.traitKey, { label: row.label, unit: row.unit ?? null });
    }

    let inserted: DnaTraitRow[] = [];
    if (stored.length > 0) {
      inserted = await tx
        .insert(dnaTraits)
        .values(
          stored.map((trait) => ({
            profileId: profile.id,
            userId,
            category: trait.category,
            traitKey: trait.traitKey,
            label: meta.get(trait.traitKey)?.label ?? trait.traitKey,
            kind: trait.kind,
            valueNumber: trait.valueNumber,
            valueText: trait.valueText,
            unit: meta.get(trait.traitKey)?.unit ?? null,
            display: trait.display ? truncate(trait.display, 255) : null,
            confidence: trait.confidence,
            sourceCount: trait.sourceCount,
            weight: trait.weight,
            firstSeenAt: trait.firstSeenAt,
            lastChangedAt: trait.lastChangedAt,
            lockedAt: trait.lockedAt,
            updatedAt: now,
          })),
        )
        .returning();
    }

    if (changes.length > 0) {
      await tx.insert(dnaTraitHistory).values(
        changes.map((change) => ({
          profileId: profile.id,
          userId,
          traitKey: change.traitKey,
          category: change.category,
          previousDisplay: change.previousDisplay ? truncate(change.previousDisplay, 255) : null,
          display: change.display ? truncate(change.display, 255) : null,
          previousNumber: change.previousNumber,
          valueNumber: change.valueNumber,
          direction: change.direction,
          changedAt: now,
        })),
      );

      // Bounded per trait, so a profile rebuilt daily for years cannot grow this
      // table without limit. The UI only reads the recent tail.
      await tx.execute(sql`
        delete from dna_trait_history
        where profile_id = ${profile.id}
          and id in (
            select id from (
              select id, row_number() over (partition by trait_key order by changed_at desc) as rn
              from dna_trait_history
              where profile_id = ${profile.id}
            ) ranked
            where ranked.rn > ${MAX_HISTORY_PER_TRAIT}
          )
      `);
    }

    return { profile, traits: sortTraits(inserted) };
  });

  const [feedback, history, signals] = await Promise.all([
    loadDnaFeedback(userId),
    loadDnaHistory(result.profile.id),
    loadDnaSignals(userId, built.profile.sourceCount),
  ]);

  return { profile: result.profile, traits: result.traits, feedback, history, signals, built };
}

/** A stored trait as the history/lock logic sees it. */
function rowToSnapshot(row: DnaTraitRow): TraitSnapshot {
  return {
    traitKey: row.traitKey,
    category: row.category,
    kind: row.kind,
    valueNumber: row.valueNumber,
    valueText: row.valueText,
    display: row.display,
    confidence: row.confidence,
    sourceCount: row.sourceCount,
    weight: row.weight,
    firstSeenAt: row.firstSeenAt,
    lastChangedAt: row.lastChangedAt,
    lockedAt: row.lockedAt,
  };
}
