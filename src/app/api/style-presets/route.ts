import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { stylePresets } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select()
    .from(stylePresets)
    .where(eq(stylePresets.userId, auth.userId))
    .orderBy(asc(stylePresets.createdAt));

  return NextResponse.json({
    presets: rows.map((r) => ({
      id: r.id,
      name: r.name,
      prompt: r.prompt,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const inserted = await db
    .insert(stylePresets)
    .values({
      userId: auth.userId,
      name: name || `Style ${new Date().toLocaleDateString()}`,
      prompt,
      notes,
    })
    .returning();

  const row = inserted[0];
  return NextResponse.json({
    preset: {
      id: row.id,
      name: row.name,
      prompt: row.prompt,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    },
  });
}
