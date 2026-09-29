import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { releasePollOptions, releasePollVotes, releasePolls, releases } from "@/db/schema";
import {
  POLL_VOTER_COOKIE,
  ensureVoterId,
  getReleasePollResult,
  isPollClosed,
} from "@/lib/release-poll";
import { checkRateLimit } from "@/lib/services/rateLimitService";

export const dynamic = "force-dynamic";

// Public vote: 1 vote per voter cookie, changeable. No login required.
// Privacy: geen IP of user-agent wordt gelezen of opgeslagen — alleen de
// random voterId-cookie telt als identiteit. Rate-limit is per voterId en
// leeft alleen in het servergeheugen (reset bij herstart).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const cookieStore = await cookies();
  const { voterId, isNew } = ensureVoterId(cookieStore.get(POLL_VOTER_COOKIE)?.value);
  if (!checkRateLimit(`poll-vote-${voterId}`)) {
    return NextResponse.json({ error: "Te veel stemmen, probeer het later opnieuw" }, { status: 429 });
  }

  const release = await db
    .select({ id: releases.id })
    .from(releases)
    .where(and(eq(releases.id, id), eq(releases.isPublic, true)))
    .limit(1);
  if (!release[0]) return NextResponse.json({ error: "Release not found" }, { status: 404 });

  const pollRows = await db
    .select({ id: releasePolls.id, isOpen: releasePolls.isOpen, closesAt: releasePolls.closesAt })
    .from(releasePolls)
    .where(eq(releasePolls.releaseId, id))
    .limit(1);
  const poll = pollRows[0];
  if (!poll) return NextResponse.json({ error: "Geen stemming voor deze release" }, { status: 404 });
  if (isPollClosed(poll.isOpen, poll.closesAt)) {
    return NextResponse.json({ error: "De stemming is gesloten" }, { status: 410 });
  }

  const body = await request.json().catch(() => null);
  const optionId = typeof body?.optionId === "string" ? body.optionId : "";
  if (!optionId) return NextResponse.json({ error: "Kies een versie" }, { status: 400 });

  const optionRows = await db
    .select({ id: releasePollOptions.id })
    .from(releasePollOptions)
    .where(and(eq(releasePollOptions.id, optionId), eq(releasePollOptions.pollId, poll.id)))
    .limit(1);
  if (!optionRows[0]) return NextResponse.json({ error: "Onbekende versie" }, { status: 400 });

  const existing = await db
    .select({ id: releasePollVotes.id })
    .from(releasePollVotes)
    .where(and(eq(releasePollVotes.pollId, poll.id), eq(releasePollVotes.voterId, voterId)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(releasePollVotes)
      .set({ optionId, voterHash: null, updatedAt: new Date() })
      .where(eq(releasePollVotes.id, existing[0].id));
  } else {
    await db.insert(releasePollVotes).values({ pollId: poll.id, optionId, voterId, voterHash: null });
  }

  const result = await getReleasePollResult(id);
  const response = NextResponse.json({ poll: { ...result, myOptionId: optionId } });
  if (isNew) {
    response.cookies.set(POLL_VOTER_COOKIE, voterId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
  }
  return response;
}
