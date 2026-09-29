import { randomUUID } from "crypto";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  releasePollOptions,
  releasePollVotes,
  releasePolls,
  releaseTracks,
} from "@/db/schema";
import { MAX_POLL_OPTIONS } from "@/lib/release-poll-constants";

export { MAX_POLL_OPTIONS, POLL_VOTER_COOKIE } from "@/lib/release-poll-constants";

export interface PollOptionResult {
  id: string;
  trackId: string;
  position: number;
  votes: number;
}

export interface PollResult {
  id: string;
  releaseId: string;
  isOpen: boolean;
  closesAt: string | null;
  isClosed: boolean;
  totalVotes: number;
  options: PollOptionResult[];
}

export function isPollClosed(isOpen: boolean, closesAt: Date | null): boolean {
  if (!isOpen) return true;
  if (closesAt && closesAt.getTime() <= Date.now()) return true;
  return false;
}

export function ensureVoterId(existing: string | undefined): { voterId: string; isNew: boolean } {
  if (existing && /^[a-zA-Z0-9-]{8,64}$/.test(existing)) {
    return { voterId: existing, isNew: false };
  }
  return { voterId: randomUUID(), isNew: true };
}

export async function getReleasePollResult(releaseId: string): Promise<PollResult | null> {
  const pollRows = await db
    .select({
      id: releasePolls.id,
      releaseId: releasePolls.releaseId,
      isOpen: releasePolls.isOpen,
      closesAt: releasePolls.closesAt,
    })
    .from(releasePolls)
    .where(eq(releasePolls.releaseId, releaseId))
    .limit(1);

  const poll = pollRows[0];
  if (!poll) return null;

  const options = await db
    .select({
      id: releasePollOptions.id,
      trackId: releasePollOptions.trackId,
      position: releasePollOptions.position,
    })
    .from(releasePollOptions)
    .where(eq(releasePollOptions.pollId, poll.id));

  const votes = await db
    .select({ optionId: releasePollVotes.optionId })
    .from(releasePollVotes)
    .where(eq(releasePollVotes.pollId, poll.id));

  const counts = new Map<string, number>();
  votes.forEach((v) => counts.set(v.optionId, (counts.get(v.optionId) ?? 0) + 1));

  const sorted = [...options].sort((a, b) => a.position - b.position);
  const totalVotes = votes.length;

  return {
    id: poll.id,
    releaseId: poll.releaseId,
    isOpen: poll.isOpen,
    closesAt: poll.closesAt?.toISOString() ?? null,
    isClosed: isPollClosed(poll.isOpen, poll.closesAt),
    totalVotes,
    options: sorted.map((o) => ({
      id: o.id,
      trackId: o.trackId,
      position: o.position,
      votes: counts.get(o.id) ?? 0,
    })),
  };
}

export async function getVoterOptionId(pollId: string, voterId: string): Promise<string | null> {
  const rows = await db
    .select({ optionId: releasePollVotes.optionId })
    .from(releasePollVotes)
    .where(and(eq(releasePollVotes.pollId, pollId), eq(releasePollVotes.voterId, voterId)))
    .limit(1);
  return rows[0]?.optionId ?? null;
}

/** Validates option trackIds: 2–3 unique ids, all belonging to the release. */
export async function validatePollTrackIds(
  releaseId: string,
  trackIds: string[]
): Promise<{ ok: true; unique: string[] } | { ok: false; error: string }> {
  const unique = [...new Set(trackIds.filter((t) => typeof t === "string" && t.trim()))];
  if (unique.length < 2) return { ok: false, error: "Kies minimaal 2 versies" };
  if (unique.length > MAX_POLL_OPTIONS)
    return { ok: false, error: `Kies maximaal ${MAX_POLL_OPTIONS} versies` };

  const rows = await db
    .select({ trackId: releaseTracks.trackId })
    .from(releaseTracks)
    .where(eq(releaseTracks.releaseId, releaseId));
  const inRelease = new Set(rows.map((r) => r.trackId));
  if (!unique.every((id) => inRelease.has(id))) {
    return { ok: false, error: "Alle versies moeten tracks uit deze release zijn" };
  }
  return { ok: true, unique };
}

export function parseClosesAt(value: unknown): Date | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "invalid";
  return date;
}
