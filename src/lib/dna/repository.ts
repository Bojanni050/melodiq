import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { dnaProfiles, dnaTraits, tracks } from "@/db/schema";
import type { AudioDna } from "@/lib/songs";

import { buildDnaProfile } from "./aggregate";
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
 * Bounds one recompute. A profile does not get more accurate from digging up
 * tracks from three years ago, and an unbounded scan would make the endpoint
 * slow for heavy users.
 */
const MAX_SOURCE_TRACKS = 500;

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
  const rows = await db
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
    })
    .from(tracks)
    .where(and(eq(tracks.userId, userId), eq(tracks.status, "done"), isNull(tracks.deletedAt)))
    .orderBy(desc(tracks.createdAt))
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
};

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

  return { profile, traits: sortTraits(rows) };
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

  return { ...result, built };
}
