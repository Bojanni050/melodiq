import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { releases } from "@/db/schema";
import {
  POLL_VOTER_COOKIE,
  ensureVoterId,
  getReleasePollResult,
  getVoterOptionId,
} from "@/lib/release-poll";

export const dynamic = "force-dynamic";

// Public, no auth: poll + results + the visitor's own vote for a published release.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const release = await db
    .select({ id: releases.id })
    .from(releases)
    .where(and(eq(releases.id, id), eq(releases.isPublic, true)))
    .limit(1);
  if (!release[0]) return NextResponse.json({ error: "Release not found" }, { status: 404 });

  const poll = await getReleasePollResult(id);
  if (!poll) return NextResponse.json({ poll: null });

  const cookieStore = await cookies();
  const voterId = cookieStore.get(POLL_VOTER_COOKIE)?.value;
  let myOptionId: string | null = null;
  if (voterId) {
    const { voterId: clean } = ensureVoterId(voterId);
    myOptionId = await getVoterOptionId(poll.id, clean);
  }

  const response = NextResponse.json({ poll: { ...poll, myOptionId } });
  // Hand out a voter cookie on first poll view so a later vote always has one.
  if (!voterId) {
    const { voterId: fresh } = ensureVoterId(undefined);
    response.cookies.set(POLL_VOTER_COOKIE, fresh, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
  }
  return response;
}
