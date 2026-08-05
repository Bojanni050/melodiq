export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSetting } from "@/lib/settings";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const model = await getSetting("OPENROUTER_TIMECODED_MODEL");
  return NextResponse.json({ model });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { model } = body as { model?: unknown };
  if (typeof model !== "string") {
    return NextResponse.json({ error: "Model must be a string" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "OPENROUTER_TIMECODED_MODEL"))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(settings)
      .set({ value: model })
      .where(eq(settings.key, "OPENROUTER_TIMECODED_MODEL"));
  } else {
    await db
      .insert(settings)
      .values({ key: "OPENROUTER_TIMECODED_MODEL", value: model });
  }

  return NextResponse.json({ success: true });
}
