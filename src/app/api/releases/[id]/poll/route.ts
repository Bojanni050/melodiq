import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { releasePollOptions, releasePollVotes, releasePolls } from "@/db/schema";
import { getUserReleaseById } from "@/lib/releases";
import { requireAuth } from "@/lib/require-auth";
import {
  MAX_POLL_OPTIONS,
  getReleasePollResult,
  parseClosesAt,
  validatePollTrackIds,
} from "@/lib/release-poll";

async function respondWithPoll(releaseId: string) {
  const poll = await getReleasePollResult(releaseId);
  return NextResponse.json({ poll });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const existing = await getUserReleaseById(auth.userId, id);
  if (!existing) return NextResponse.json({ error: "Release not found" }, { status: 404 });

  return respondWithPoll(id);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const existing = await getUserReleaseById(auth.userId, id);
  if (!existing) return NextResponse.json({ error: "Release not found" }, { status: 404 });

  try {
    const body = await request.json().catch(() => null);
    const trackIds = Array.isArray(body?.trackIds) ? body.trackIds : [];
    const closesAt = parseClosesAt(body?.closesAt);

    if (closesAt === "invalid") {
      return NextResponse.json({ error: "Ongeldige einddatum" }, { status: 400 });
    }

    const validated = await validatePollTrackIds(id, trackIds);
    if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

    const current = await db
      .select({ id: releasePolls.id })
      .from(releasePolls)
      .where(eq(releasePolls.releaseId, id))
      .limit(1);

    let pollId: string;
    if (current[0]) {
      pollId = current[0].id;
      await db
        .update(releasePolls)
        .set({ isOpen: true, closesAt, updatedAt: new Date() })
        .where(eq(releasePolls.id, pollId));
      // Replace options; votes on removed options are cascade-deleted.
      await db.delete(releasePollOptions).where(eq(releasePollOptions.pollId, pollId));
    } else {
      const inserted = await db
        .insert(releasePolls)
        .values({ releaseId: id, userId: auth.userId, isOpen: true, closesAt })
        .returning({ id: releasePolls.id });
      if (!inserted[0]) return NextResponse.json({ error: "Failed to create poll" }, { status: 500 });
      pollId = inserted[0].id;
    }

    await db.insert(releasePollOptions).values(
      validated.unique.map((trackId, position) => ({ pollId, trackId, position }))
    );

    // Drop votes whose option no longer exists (only when options were replaced).
    const validOptionIds = await db
      .select({ id: releasePollOptions.id })
      .from(releasePollOptions)
      .where(eq(releasePollOptions.pollId, pollId));
    const validSet = new Set(validOptionIds.map((o) => o.id));
    const allVotes = await db
      .select({ id: releasePollVotes.id, optionId: releasePollVotes.optionId })
      .from(releasePollVotes)
      .where(eq(releasePollVotes.pollId, pollId));
    for (const vote of allVotes) {
      if (!validSet.has(vote.optionId)) {
        await db.delete(releasePollVotes).where(eq(releasePollVotes.id, vote.id));
      }
    }

    return respondWithPoll(id);
  } catch (error) {
    console.error("[releases/poll/post]", error);
    return NextResponse.json({ error: "Failed to save poll" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const existing = await getUserReleaseById(auth.userId, id);
  if (!existing) return NextResponse.json({ error: "Release not found" }, { status: 404 });

  try {
    const body = await request.json().catch(() => null);

    const pollRows = await db
      .select({ id: releasePolls.id })
      .from(releasePolls)
      .where(eq(releasePolls.releaseId, id))
      .limit(1);
    if (!pollRows[0]) return NextResponse.json({ error: "Poll not found" }, { status: 404 });

    const updates: { isOpen?: boolean; closesAt?: Date | null; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (typeof body?.isOpen === "boolean") updates.isOpen = body.isOpen;
    if (body?.closesAt !== undefined) {
      const closesAt = parseClosesAt(body.closesAt);
      if (closesAt === "invalid") {
        return NextResponse.json({ error: "Ongeldige einddatum" }, { status: 400 });
      }
      updates.closesAt = closesAt;
    }

    if (Array.isArray(body?.trackIds)) {
      const validated = await validatePollTrackIds(id, body.trackIds);
      if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
      await db.delete(releasePollOptions).where(eq(releasePollOptions.pollId, pollRows[0].id));
      await db.insert(releasePollOptions).values(
        validated.unique.map((trackId, position) => ({ pollId: pollRows[0].id, trackId, position }))
      );
      if (validated.unique.length > MAX_POLL_OPTIONS) {
        return NextResponse.json({ error: `Maximaal ${MAX_POLL_OPTIONS} versies` }, { status: 400 });
      }
    }

    await db.update(releasePolls).set(updates).where(eq(releasePolls.id, pollRows[0].id));

    // Drop orphan votes after option replacement.
    const validOptionIds = await db
      .select({ id: releasePollOptions.id })
      .from(releasePollOptions)
      .where(eq(releasePollOptions.pollId, pollRows[0].id));
    const validSet = new Set(validOptionIds.map((o) => o.id));
    const allVotes = await db
      .select({ id: releasePollVotes.id, optionId: releasePollVotes.optionId })
      .from(releasePollVotes)
      .where(eq(releasePollVotes.pollId, pollRows[0].id));
    for (const vote of allVotes) {
      if (!validSet.has(vote.optionId)) {
        await db.delete(releasePollVotes).where(eq(releasePollVotes.id, vote.id));
      }
    }

    return respondWithPoll(id);
  } catch (error) {
    console.error("[releases/poll/patch]", error);
    return NextResponse.json({ error: "Failed to update poll" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const existing = await getUserReleaseById(auth.userId, id);
  if (!existing) return NextResponse.json({ error: "Release not found" }, { status: 404 });

  await db.delete(releasePolls).where(and(eq(releasePolls.releaseId, id), eq(releasePolls.userId, auth.userId)));
  return NextResponse.json({ success: true, poll: null });
}
