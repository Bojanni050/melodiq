import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { lyricPersonas } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import {
  MAX_PERSONA_BIO,
  MAX_PERSONA_FRAGMENTS,
  MAX_PERSONA_NAME,
  sanitizePersonaFragments,
} from "@/lib/lyric-personas";
import { mapPersonaRow } from "@/lib/lyric-persona-mapping";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body?.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_PERSONA_NAME) : "";
    if (!name) {
      return NextResponse.json({ error: "Persona name is required" }, { status: 400 });
    }
    updates.name = name;
  }
  if (body?.bio !== undefined) {
    updates.bio = typeof body.bio === "string" ? body.bio.trim().slice(0, MAX_PERSONA_BIO) : "";
  }
  if (body?.fragments !== undefined) {
    updates.fragments = JSON.stringify(sanitizePersonaFragments(body.fragments, MAX_PERSONA_FRAGMENTS));
  }

  const updated = await db
    .update(lyricPersonas)
    .set(updates)
    .where(and(eq(lyricPersonas.id, id), eq(lyricPersonas.userId, auth.userId)))
    .returning();

  if (updated.length === 0) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }

  return NextResponse.json({ persona: mapPersonaRow(updated[0]) });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const deleted = await db
    .delete(lyricPersonas)
    .where(and(eq(lyricPersonas.id, id), eq(lyricPersonas.userId, auth.userId)))
    .returning({ id: lyricPersonas.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
