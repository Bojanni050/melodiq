/**
 * Backfill script: re-measure the DSP half of Track DNA for finished tracks.
 *
 * Why this exists: `music-tempo` assumes 44.1 kHz (441-sample hops called 10 ms)
 * while audio-features.ts decodes at 22.05 kHz, so every inter-onset interval
 * was read at half its length. Tracks slower than ~100 BPM therefore came back
 * at double tempo (85 measured as 170), and that wrong value is already stored
 * in tracks.audio_dna. It cannot be repaired by halving: a stored 170 can be a
 * real 170 as well as a doubled 85. The audio has to be measured again.
 *
 * Only tempo/key/energy/loudness are recomputed. Atmosphere tags, lyrics score
 * and composition notes are kept as they are, so no paid LLM call is repeated.
 *
 * Run with:
 *   npx tsx scripts/backfill-tempo.ts                      # dry run, first 25
 *   npx tsx scripts/backfill-tempo.ts --limit 200          # dry run, first 200
 *   npx tsx scripts/backfill-tempo.ts --all                # dry run, everything
 *   npx tsx scripts/backfill-tempo.ts --apply --all        # write
 *   npx tsx scripts/backfill-tempo.ts --user you@mail.com --apply
 *   npx tsx scripts/backfill-tempo.ts --track 53ebbf         # one track, by id prefix
 *   npx tsx scripts/backfill-tempo.ts --concurrency 1      # slower, lighter CPU
 *   npx tsx scripts/backfill-tempo.ts --track-timeout 300  # give up on a track after 5 min
 *
 * Requires DATABASE_URL (env, .env.local, or the container's env) and the S3
 * settings. See scripts/env.ts for why that lives in its own module.
 * After writing, rebuild the Melody DNA profile so the new tempos are used.
 */

import "./env";

import { db } from "@/db";
import { tracks, users } from "@/db/schema";
import { and, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import { extractAudioFeatures, type AudioFeatures } from "@/lib/audio-features";
import { resolveDnaAudioSource } from "@/lib/dna-audio-source";
import type { AudioDna } from "@/lib/songs";

type Row = {
  id: string;
  title: string | null;
  audioDna: string | null;
};

type Outcome =
  | { id: string; title: string; status: "changed"; before: number | null; after: number | null; features: AudioFeatures }
  | { id: string; title: string; status: "same"; before: number | null; after: number | null }
  | { id: string; title: string; status: "failed"; reason: string };

function parseArgs(argv: string[]) {
  const options = {
    apply: false,
    all: false,
    limit: 25,
    user: null as string | null,
    track: null as string | null,
    concurrency: 2,
    skipRecentDays: 0,
    trackTimeoutMs: 600_000,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--all") options.all = true;
    else if (arg === "--limit") options.limit = Math.max(1, Number(argv[++i]) || options.limit);
    else if (arg === "--concurrency") options.concurrency = Math.min(8, Math.max(1, Number(argv[++i]) || 2));
    else if (arg === "--user") options.user = argv[++i] ?? null;
    else if (arg === "--track") options.track = argv[++i] ?? null;
    else if (arg === "--skip-recent-days") options.skipRecentDays = Math.max(0, Number(argv[++i]) || 0);
    else if (arg === "--track-timeout")
      options.trackTimeoutMs = Math.max(30, Number(argv[++i]) || 600) * 1000;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: npx tsx scripts/backfill-tempo.ts [--apply] [--all | --limit N] [--user <email|id>] [--track <id|prefix>] [--concurrency N] [--skip-recent-days N] [--track-timeout SECONDS]",
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  return options;
}

function parseDna(raw: string | null): Partial<AudioDna> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Partial<AudioDna>) : null;
  } catch {
    return null;
  }
}

/** Reads the audio once and returns the freshly measured DSP features. */
async function measure(trackId: string): Promise<{ features: AudioFeatures | null; reason?: string }> {
  const [track] = await db.select().from(tracks).where(eq(tracks.id, trackId)).limit(1);
  if (!track) return { features: null, reason: "track not found" };

  const source = await resolveDnaAudioSource(track);
  if (!source) return { features: null, reason: "no audio source" };

  const features = await extractAudioFeatures(source.audioBuffer);
  if (!features) return { features: null, reason: "feature extraction failed" };
  return { features };
}

/**
 * A stalled object-storage read once left three workers waiting for hours with no
 * output, which looks exactly like a healthy run until you notice the log stopped
 * growing. The deadline cannot cancel the abandoned work — the socket is only
 * released when the process exits — but it keeps one bad track from stalling the
 * whole batch, and a later pass retries it.
 */
async function measureWithDeadline(
  trackId: string,
  timeoutMs: number,
): Promise<{ features: AudioFeatures | null; reason?: string }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<{ features: null; reason: string }>((resolve) => {
    timer = setTimeout(
      () => resolve({ features: null, reason: `timed out after ${Math.round(timeoutMs / 1000)}s` }),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([measure(trackId), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

async function processTrack(row: Row, apply: boolean, trackTimeoutMs: number): Promise<Outcome> {
  const existing = parseDna(row.audioDna);
  const title = row.title ?? "(untitled)";
  const before = existing?.tempo ?? null;

  const { features, reason } = await measureWithDeadline(row.id, trackTimeoutMs);
  if (!features) return { id: row.id, title, status: "failed", reason: reason ?? "unknown" };

  const next: AudioDna = {
    tempo: features.tempo ?? existing?.tempo ?? null,
    key: features.key ?? existing?.key ?? null,
    energy: features.energy ?? existing?.energy ?? null,
    loudness: features.loudness ?? existing?.loudness ?? null,
    atmosphereTags: existing?.atmosphereTags ?? null,
    lyricsScore: existing?.lyricsScore ?? null,
    lyricsNotes: existing?.lyricsNotes ?? null,
    compositionScore: existing?.compositionScore ?? null,
    compositionNotes: existing?.compositionNotes ?? null,
    computedAt: new Date().toISOString(),
  };

  const changed =
    next.tempo !== (existing?.tempo ?? null) ||
    next.key !== (existing?.key ?? null) ||
    next.energy !== (existing?.energy ?? null) ||
    next.loudness !== (existing?.loudness ?? null);

  if (!changed) {
    return { id: row.id, title, status: "same", before, after: next.tempo };
  }

  if (apply) {
    await db.update(tracks).set({ audioDna: JSON.stringify(next) }).where(eq(tracks.id, row.id));
  }

  return { id: row.id, title, status: "changed", before, after: next.tempo, features };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  let userFilter: string | null = null;
  if (options.user) {
    const [match] = await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.email, options.user), eq(users.id, options.user)))
      .limit(1);
    if (!match) {
      console.error(`No user found for "${options.user}"`);
      process.exitCode = 1;
      return;
    }
    userFilter = match.id;
  }

  // A single track is the fastest way to judge the correction: the dry run on a
  // random batch only proves something if that batch happens to contain a slow
  // song. Accepts the short id shown in the UI (any unique prefix, '#' allowed).
  const trackPrefix = options.track ? options.track.replace(/^#/, "").trim().toLowerCase() : null;
  if (trackPrefix !== null && !/^[0-9a-f][0-9a-f-]{3,35}$/.test(trackPrefix)) {
    console.error(`"${options.track}" does not look like a track id or id prefix.`);
    process.exitCode = 1;
    return;
  }

  const filters = [eq(tracks.status, "done"), isNotNull(tracks.audioDna)];
  if (userFilter) filters.push(eq(tracks.userId, userFilter));
  if (trackPrefix) filters.push(sql`lower(${tracks.id}::text) like ${`${trackPrefix}%`}`);

  const rows = await db
    .select({ id: tracks.id, title: tracks.title, audioDna: tracks.audioDna })
    .from(tracks)
    .where(and(...filters))
    .orderBy(desc(tracks.createdAt));

  if (trackPrefix && rows.length === 0) {
    console.error(`No finished, analysed track whose id starts with "${trackPrefix}".`);
    process.exitCode = 1;
    return;
  }

  // Interrupting a run is normal (hours of audio), so a second pass can skip the
  // tracks whose computedAt was just rewritten instead of downloading them again.
  const cutoff =
    options.skipRecentDays > 0 && !trackPrefix
      ? Date.now() - options.skipRecentDays * 86_400_000
      : null;
  const eligible = cutoff
    ? rows.filter((row) => {
        const computedAt = parseDna(row.audioDna)?.computedAt;
        const time = computedAt ? Date.parse(computedAt) : Number.NaN;
        return !Number.isFinite(time) || time < cutoff;
      })
    : rows;
  const skippedRecent = rows.length - eligible.length;

  const batch = options.all || trackPrefix ? eligible : eligible.slice(0, options.limit);

  console.log(
    `${options.apply ? "Re-measuring" : "Dry run — nothing is written"}: ${batch.length} of ${eligible.length} finished tracks` +
      `${userFilter ? ` for user ${options.user}` : ""}` +
      `${trackPrefix ? ` matching id ${trackPrefix}*` : ""}` +
      `${skippedRecent > 0 ? ` (${skippedRecent} skipped as recently analysed)` : ""}` +
      ` (concurrency ${options.concurrency})\n`,
  );

  const outcomes: Outcome[] = [];
  for (let i = 0; i < batch.length; i += options.concurrency) {
    const slice = batch.slice(i, i + options.concurrency);
    const results = await Promise.all(
      slice.map((row) => processTrack(row, options.apply, options.trackTimeoutMs)),
    );
    outcomes.push(...results);

    for (const result of results) {
      if (result.status === "changed") {
        const delta = result.before != null && result.after != null ? result.after - result.before : null;
        const arrow = delta == null ? "  new" : delta === 0 ? "     " : delta > 0 ? `  +${delta}` : `  ${delta}`;
        console.log(
          `${result.id}  ${String(result.before ?? "—").padStart(4)} → ${String(result.after ?? "—").padStart(4)}${arrow}  ${result.title.slice(0, 48)}`,
        );
      } else if (result.status === "same") {
        console.log(`${result.id}  ${String(result.before ?? "—").padStart(4)}   same            ${result.title.slice(0, 48)}`);
      } else {
        console.log(`${result.id}  ---- failed: ${result.reason} — ${result.title.slice(0, 40)}`);
      }
    }
  }

  const changed = outcomes.filter((o) => o.status === "changed").length;
  const same = outcomes.filter((o) => o.status === "same").length;
  const failed = outcomes.filter((o) => o.status === "failed").length;

  console.log(`\n${changed} changed, ${same} unchanged, ${failed} failed.`);
  if (!options.apply) {
    console.log("Dry run only — rerun with --apply to write these values.");
  } else if (changed > 0) {
    console.log("Written. Rebuild the Melody DNA profile to use the new tempos.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
