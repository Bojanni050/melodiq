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

// A confident language mismatch scores 0, not a fraction. It is a contradiction
// rather than a partial match, and a fraction cannot express how much: any
// penalty high enough to sink a shared style-prompt pair also sank a genuine
// near-identical lyric pair. Scoring 0 at weight 0.3 gets both right — a
// same-style song in another language drops to ~0.50 (below the threshold)
// while near-identical lyrics land at ~0.57 and still group.
//
// It is a scored signal rather than a hard filter for the same reason: the
// `tracks.language` column is only populated for tracks the user has actually
// played (see language-detect.ts), so splitting strictly on language would
// silently drop most pairs on a cold library. An unknown language contributes
// nothing at all, leaving such a pair scored exactly as it was before.
const WEIGHTS = { lyrics: 0.4, prompt: 0.3, audioDna: 0.15, title: 0.05, language: 0.3 } as const;

export type SimilarityMatchSignal = "lyrics" | "prompt" | "audioDna" | "title" | "language";

export type SimilarityCandidateGroup = {
  id: string;
  trackIds: string[];
  score: number;
  matchedOn: SimilarityMatchSignal[];
  // Dominant language across the group, for display. Null when the members
  // disagree or none of them has a known language.
  language: string | null;
};

export type TrackForSimilarity = {
  id: string;
  title: string | null;
  lyrics: string | null;
  prompt: string | null;
  audioDna: AudioDna | null;
  language?: string | null;
};

// Language names arrive from an LLM ("Dutch"), from the Lyric Studio picker
// ("Nederlands", "nl"), or from a user's own input — all free-form. Normalising
// to a canonical English key keeps "Dutch", "dutch" and "Nederlands" from
// looking like three different languages. Unlisted languages fall back to the
// lowercased trimmed string, so an unexpected value still groups consistently
// with itself instead of never matching anything.
const LANGUAGE_ALIASES: Record<string, string> = {
  dutch: "dutch",
  nederlands: "dutch",
  nl: "dutch",
  english: "english",
  engels: "english",
  en: "english",
  spanish: "spanish",
  espanol: "spanish",
  es: "spanish",
  french: "french",
  francais: "french",
  fr: "french",
  german: "german",
  deutsch: "german",
  duits: "german",
  de: "german",
  italian: "italian",
  italiaans: "italian",
  it: "italian",
  portuguese: "portuguese",
  portugues: "portuguese",
  pt: "portuguese",
  swedish: "swedish",
  svenska: "swedish",
  sv: "swedish",
  norwegian: "norwegian",
  norsk: "norwegian",
  danish: "danish",
  dansk: "danish",
  finnish: "finnish",
  suomi: "finnish",
  polish: "polish",
  polski: "polish",
  russian: "russian",
  russkiy: "russian",
  turkish: "turkish",
  turkce: "turkish",
  arabic: "arabic",
  hebrew: "hebrew",
  greek: "greek",
  japanese: "japanese",
  korean: "korean",
  chinese: "chinese",
};

const LANGUAGE_DISPLAY: Record<string, string> = {
  dutch: "Dutch",
  english: "English",
  spanish: "Spanish",
  french: "French",
  german: "German",
  italian: "Italian",
  portuguese: "Portuguese",
  swedish: "Swedish",
  norwegian: "Norwegian",
  danish: "Danish",
  finnish: "Finnish",
  polish: "Polish",
  russian: "Russian",
  turkish: "Turkish",
  arabic: "Arabic",
  hebrew: "Hebrew",
  greek: "Greek",
  japanese: "Japanese",
  korean: "Korean",
  chinese: "Chinese",
};

/** Canonical key for a language label, or null when absent or explicitly unknown. */
export function normalizeLanguage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/[.!]+$/, "");
  if (!key || key === "unknown" || key === "onbekend") return null;
  return LANGUAGE_ALIASES[key] ?? key;
}

/** Human-readable label for a canonical language key. */
export function languageLabel(key: string | null): string | null {
  if (!key) return null;
  return LANGUAGE_DISPLAY[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

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

// Per-track token cache keyed by object identity, so groupBySimilarity's
// O(n^2) pairwise scan tokenizes each track's lyrics/prompt/title once
// instead of ~n times (lyrics can be large — this matters at library scale).
const tokenCache = new WeakMap<TrackForSimilarity, { lyrics: Set<string>; prompt: Set<string>; title: Set<string> }>();

function tokensFor(track: TrackForSimilarity) {
  let cached = tokenCache.get(track);
  if (!cached) {
    cached = {
      lyrics: tokenize(track.lyrics ?? ""),
      prompt: tokenize(track.prompt ?? ""),
      title: tokenize(track.title ?? ""),
    };
    tokenCache.set(track, cached);
  }
  return cached;
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
  const tokensA = tokensFor(trackA);
  const tokensB = tokensFor(trackB);

  if (trackA.lyrics?.trim() && trackB.lyrics?.trim()) {
    signals.push({ key: "lyrics", value: jaccard(tokensA.lyrics, tokensB.lyrics), weight: WEIGHTS.lyrics });
  }
  if (trackA.prompt?.trim() && trackB.prompt?.trim()) {
    signals.push({ key: "prompt", value: jaccard(tokensA.prompt, tokensB.prompt), weight: WEIGHTS.prompt });
  }
  if (trackA.audioDna && trackB.audioDna) {
    signals.push({
      key: "audioDna",
      value: 1 - computeAudioDnaDistance(trackA.audioDna, trackB.audioDna),
      weight: WEIGHTS.audioDna,
    });
  }

  const hasPrimarySignal = signals.length > 0;

  // Language is a confidence signal, not a gate: it only contributes when both
  // sides actually have a detected language. Same language scores 1; a clear
  // mismatch scores 0, which is enough to outweigh a shared style prompt while
  // still letting near-identical lyrics win the pair.
  const langA = normalizeLanguage(trackA.language);
  const langB = normalizeLanguage(trackB.language);
  if (langA && langB) {
    signals.push({
      key: "language",
      value: langA === langB ? 1 : 0,
      weight: WEIGHTS.language,
    });
  }

  // Title is only ever added alongside at least one primary signal — with
  // no lyrics/prompt/audioDna to compare, there's no basis for a match.
  // Skipped when both titles are empty too, so two untitled tracks don't
  // get penalized by a spurious empty-vs-empty comparison.
  if (hasPrimarySignal && (trackA.title?.trim() || trackB.title?.trim())) {
    signals.push({ key: "title", value: jaccard(tokensA.title, tokensB.title), weight: WEIGHTS.title });
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

  // Dominant language = the one shared by the most members. A group only gets a
  // language when every member that has one agrees; a single outlier (say one
  // translated track in a Dutch group) leaves the label off rather than
  // claiming something untrue.
  const languageById = new Map(tracksForSimilarity.map((t) => [t.id, normalizeLanguage(t.language)]));

  return Array.from(groups.entries())
    .filter(([, g]) => g.trackIds.size >= 2)
    .map(([root, g]) => {
      const memberLanguages = Array.from(g.trackIds)
        .map((id) => languageById.get(id) ?? null)
        .filter((l): l is string => l !== null);
      const unique = new Set(memberLanguages);
      const language = unique.size === 1 ? Array.from(unique)[0] : null;
      return {
        id: root,
        trackIds: Array.from(g.trackIds),
        score: g.scores.reduce((sum, s) => sum + s, 0) / g.scores.length,
        matchedOn: Array.from(g.matchedOn),
        language,
      };
    });
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
      language: tracks.language,
      releaseStatus: tracks.releaseStatus,
    })
    .from(tracks)
    .where(and(eq(tracks.userId, userId), isNull(tracks.deletedAt), isNull(tracks.archivedAt), isNull(tracks.hiddenAt)));

  // Published / Master Track / playlist members are NO LONGER excluded here.
  // They used to be dropped before grouping so a group could never form around
  // a track that could not itself be archived. Archiving is now a soft,
  // informed choice rather than a blocked one, so those tracks participate
  // normally and the UI warns per track at confirmation time instead.
  const forSimilarity: TrackForSimilarity[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    lyrics: row.lyrics,
    prompt: row.prompt,
    audioDna: parseAudioDnaJson(row.audioDna),
    language: row.language,
  }));

  return groupBySimilarity(forSimilarity, options?.minScore);
}
