import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clonedVoices } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";

/**
 * Marks one cloned voice as the one the Studio sends as persona_id — at most
 * one per user. This lives on the voice rows instead of the settings table
 * (which is app-global) so it is per-user and follows the voice list across
 * devices.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body = await request.json().catch(() => null);
  if (typeof body?.voiceId !== "string") {
    return NextResponse.json({ error: "A voiceId is required" }, { status: 400 });
  }
  const voiceId = body.voiceId;

  const rows = await db
    .select()
    .from(clonedVoices)
    .where(and(eq(clonedVoices.id, voiceId), eq(clonedVoices.userId, userId)));

  if (rows.length === 0) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  }
  if (rows[0].status !== "completed") {
    return NextResponse.json({ error: "Only finished voices can be selected" }, { status: 400 });
  }

  await db.transaction(async (tx) => {
    // One selection per user: clear the old flag first, then set the new one —
    // inside a transaction so a concurrent read can never see two selected.
    await tx.update(clonedVoices).set({ isSelected: false }).where(eq(clonedVoices.userId, userId));
    await tx
      .update(clonedVoices)
      .set({ isSelected: true, updatedAt: new Date() })
      .where(eq(clonedVoices.id, voiceId));
  });

  const voices = await db
    .select()
    .from(clonedVoices)
    .where(eq(clonedVoices.userId, userId))
    .orderBy(desc(clonedVoices.createdAt));

  return NextResponse.json({ voices });
}
