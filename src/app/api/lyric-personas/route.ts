import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
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

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select()
    .from(lyricPersonas)
    .where(eq(lyricPersonas.userId, auth.userId))
    .orderBy(desc(lyricPersonas.updatedAt));

  return NextResponse.json({ personas: rows.map(mapPersonaRow) });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, MAX_PERSONA_NAME) : "";
  const bio = typeof body?.bio === "string" ? body.bio.trim().slice(0, MAX_PERSONA_BIO) : "";
  const fragments = sanitizePersonaFragments(body?.fragments, MAX_PERSONA_FRAGMENTS);

  if (!name) {
    return NextResponse.json({ error: "Persona name is required" }, { status: 400 });
  }

  const inserted = await db
    .insert(lyricPersonas)
    .values({ userId: auth.userId, name, bio, fragments: JSON.stringify(fragments) })
    .returning();

  return NextResponse.json({ persona: mapPersonaRow(inserted[0]) });
}
