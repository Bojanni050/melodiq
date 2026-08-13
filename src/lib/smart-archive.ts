import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { tracks } from "@/db/schema";
import type { AudioDna } from "@/lib/songs";

// Tunable — no real user data to calibrate against yet, easy to adjust here.
export const DEFAULT_SIMILARITY_THRESHOLD = 0.55;

// A signal must score at least this high (on its own 0..1 scale) to be
// listed as a "matched on" reason for a pair. Title never counts here —
// it's a weak extra signal, never a standalone trigger.
const MATCH_SIGNAL_THRESHOLD = 0.5;

const WEIGHTS = { lyrics: 0.4, prompt: 0.35, audioDna: 0.15, title: 0.1 } as const;

export type SimilarityMatchSignal = "lyrics" | "prompt" | "audioDna" | "title";

export type SimilarityCandidateGroup = {
  id: string;
  trackIds: string[];
  score: number;
  matchedOn: SimilarityMatchSignal[];
};

export type TrackForSimilarity = {
  id: string;
  title: string | null;
  lyrics: string | null;
  prompt: string | null;
  audioDna: AudioDna | null;
};

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length > 0)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Token-set Jaccard similarity, 0..1. Cheap and explainable — good enough
// for an O(n^2) pairwise scan over a user's library, no external dependency.
export function computeTextSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  return jaccard(tokenize(a ?? ""), tokenize(b ?? ""));
}

// Heuristic 0..1 distance (lower = closer) over the existing AudioDna JSON
// fields — there's no real audio fingerprint/embedding in this codebase, so
// this approximates "audioDna nearness" from tempo/key/energy/loudness/tags.
export function computeAudioDnaDistance(a: AudioDna | null, b: AudioDna | null): number {
  if (!a || !b) return 1;

  const parts: number[] = [];

  if (a.tempo != null && b.tempo != null) {
    parts.push(Math.min(1, Math.abs(a.tempo - b.tempo) / 60));
  }
  if (a.energy != null && b.energy != null) {
    parts.push(Math.min(1, Math.abs(a.energy - b.energy) / 100));
  }
  if (a.loudness != null && b.loudness != null) {
    parts.push(Math.min(1, Math.abs(a.loudness - b.loudness) / 20));
  }
  if (a.key != null && b.key != null) {
    parts.push(a.key === b.key ? 0 : 1);
  }
  if (a.atmosphereTags && b.atmosphereTags && (a.atmosphereTags.length > 0 || b.atmosphereTags.length > 0)) {
    const similarity = jaccard(
      new Set(a.atmosphereTags.map((t) => t.toLowerCase())),
      new Set(b.atmosphereTags.map((t) => t.toLowerCase()))
    );
    parts.push(1 - similarity);
  }

  if (parts.length === 0) return 1;
  return parts.reduce((sum, p) => sum + p, 0) / parts.length;
}

// Weighted aggregate over available signals. Missing signals (e.g. no
// lyrics on an instrumental) are dropped and the rest reweighted, rather
// than penalized. If lyrics/prompt/audioDna are ALL unavailable for a pair,
// title alone must never carry a match — score is forced to 0 in that case.
export function computePairScore(
  trackA: TrackForSimilarity,
  trackB: TrackForSimilarity
): { score: number; matchedOn: SimilarityMatchSignal[] } {
  const signals: { key: SimilarityMatchSignal; value: number; weight: number }[] = [];

  if (trackA.lyrics?.trim() && trackB.lyrics?.trim()) {
    signals.push({ key: "lyrics", value: computeTextSimilarity(trackA.lyrics, trackB.lyrics), weight: WEIGHTS.lyrics });
  }
  if (trackA.prompt?.trim() && trackB.prompt?.trim()) {
    signals.push({ key: "prompt", value: computeTextSimilarity(trackA.prompt, trackB.prompt), weight: WEIGHTS.prompt });
  }
  if (trackA.audioDna && trackB.audioDna) {
    signals.push({
      key: "audioDna",
      value: 1 - computeAudioDnaDistance(trackA.audioDna, trackB.audioDna),
      weight: WEIGHTS.audioDna,
    });
  }

  const hasPrimarySignal = signals.length > 0;

  // Title is only ever added alongside at least one primary signal — with
  // no lyrics/prompt/audioDna to compare, there's no basis for a match.
  if (hasPrimarySignal) {
    signals.push({ key: "title", value: computeTextSimilarity(trackA.title, trackB.title), weight: WEIGHTS.title });
  }

  if (!hasPrimarySignal) return { score: 0, matchedOn: [] };

  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const score = signals.reduce((sum, s) => sum + s.value * s.weight, 0) / totalWeight;
  const matchedOn = signals.filter((s) => s.key !== "title" && s.value >= MATCH_SIGNAL_THRESHOLD).map((s) => s.key);

  return { score, matchedOn };
}

// Pure, unit-testable: pairwise scoring + union-find clustering on pairs
// scoring >= minScore. Groups of size 1 (no match) are dropped.
export function groupBySimilarity(
  tracksForSimilarity: TrackForSimilarity[],
  minScore: number = DEFAULT_SIMILARITY_THRESHOLD
): SimilarityCandidateGroup[] {
  const parent = new Map<string, string>();
  for (const t of tracksForSimilarity) parent.set(t.id, t.id);

  function find(id: string): string {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  }
  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  type Edge = { a: string; b: string; score: number; matchedOn: SimilarityMatchSignal[] };
  const edges: Edge[] = [];

  for (let i = 0; i < tracksForSimilarity.length; i++) {
    for (let j = i + 1; j < tracksForSimilarity.length; j++) {
      const { score, matchedOn } = computePairScore(tracksForSimilarity[i], tracksForSimilarity[j]);
      if (score >= minScore && matchedOn.length > 0) {
        edges.push({ a: tracksForSimilarity[i].id, b: tracksForSimilarity[j].id, score, matchedOn });
      }
    }
  }

  for (const edge of edges) union(edge.a, edge.b);

  const groups = new Map<string, { trackIds: Set<string>; scores: number[]; matchedOn: Set<SimilarityMatchSignal> }>();
  for (const edge of edges) {
    const root = find(edge.a);
    if (!groups.has(root)) groups.set(root, { trackIds: new Set(), scores: [], matchedOn: new Set() });
    const g = groups.get(root)!;
    g.trackIds.add(edge.a);
    g.trackIds.add(edge.b);
    g.scores.push(edge.score);
    edge.matchedOn.forEach((m) => g.matchedOn.add(m));
  }

  return Array.from(groups.entries())
    .filter(([, g]) => g.trackIds.size >= 2)
    .map(([root, g]) => ({
      id: root,
      trackIds: Array.from(g.trackIds),
      score: g.scores.reduce((sum, s) => sum + s, 0) / g.scores.length,
      matchedOn: Array.from(g.matchedOn),
    }));
}

function parseAudioDnaJson(raw: string | null): AudioDna | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AudioDna;
  } catch {
    return null;
  }
}

// Thin DB-fetch wrapper around the pure groupBySimilarity.
export async function findDuplicateCandidateGroups(
  userId: string,
  options?: { minScore?: number }
): Promise<SimilarityCandidateGroup[]> {
  const rows = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      lyrics: tracks.lyrics,
      prompt: tracks.prompt,
      audioDna: tracks.audioDna,
    })
    .from(tracks)
    .where(and(eq(tracks.userId, userId), isNull(tracks.deletedAt), isNull(tracks.archivedAt)));

  const forSimilarity: TrackForSimilarity[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    lyrics: row.lyrics,
    prompt: row.prompt,
    audioDna: parseAudioDnaJson(row.audioDna),
  }));

  return groupBySimilarity(forSimilarity, options?.minScore);
}
