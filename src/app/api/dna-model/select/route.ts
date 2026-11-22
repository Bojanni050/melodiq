import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { dnaModels } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

/**
 * Marks one DNA model as the one the Studio sends as `custom_model_id` — at
 * most one per user, the counterpart of /api/voice/select. Only completed
 * models can be picked: a pending row has no model id to send yet.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "A model id is required" }, { status: 400 });

  const rows = await db
    .select()
    .from(dnaModels)
    .where(and(eq(dnaModels.id, id), eq(dnaModels.userId, userId)));

  if (rows.length === 0) return NextResponse.json({ error: "Model not found" }, { status: 404 });
  if (rows[0].status !== "completed") {
    return NextResponse.json({ error: "This model is not ready yet" }, { status: 400 });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(dnaModels)
      .set({ isSelected: false, updatedAt: new Date() })
      .where(eq(dnaModels.userId, userId));
    await tx
      .update(dnaModels)
      .set({ isSelected: true, updatedAt: new Date() })
      .where(eq(dnaModels.id, id));
  });

  const models = await db
    .select()
    .from(dnaModels)
    .where(eq(dnaModels.userId, userId))
    .orderBy(desc(dnaModels.createdAt));

  return NextResponse.json({ models });
}
