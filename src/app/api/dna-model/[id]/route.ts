import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { dnaModels } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

const MAX_NAME_LENGTH = 160;

/**
 * Renames a DNA model. The name is also what APIMart was given as the custom
 * model name, but it is only a label: the trained model behind `modelId` is
 * never touched, so renaming cannot change what the model sounds like.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("name" in body)) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Give the model a name" }, { status: 400 });
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: `Keep the name under ${MAX_NAME_LENGTH} characters` }, { status: 400 });
  }

  const updated = await db
    .update(dnaModels)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(dnaModels.id, id), eq(dnaModels.userId, userId)))
    .returning();

  if (updated.length === 0) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  return NextResponse.json({ model: updated[0] });
}

/**
 * Removes a DNA model from MelodIQ. APIMart has no documented delete endpoint
 * for custom models either, so this only forgets the local row (and the model
 * id with it). Tracks that were generated with it keep their audio.
 *
 * When the deleted model was the selected one, the newest remaining completed
 * model takes over — or none, in which case the Studio's model toggle simply
 * has nothing to send.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const rows = await db
    .select()
    .from(dnaModels)
    .where(and(eq(dnaModels.id, id), eq(dnaModels.userId, userId)));

  if (rows.length === 0) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  const deleted = rows[0];

  await db.transaction(async (tx) => {
    await tx.delete(dnaModels).where(and(eq(dnaModels.id, id), eq(dnaModels.userId, userId)));

    if (deleted.isSelected) {
      const [nextModel] = await tx
        .select({ id: dnaModels.id })
        .from(dnaModels)
        .where(and(eq(dnaModels.userId, userId), eq(dnaModels.status, "completed")))
        .orderBy(desc(dnaModels.createdAt))
        .limit(1);

      if (nextModel) {
        await tx
          .update(dnaModels)
          .set({ isSelected: true, updatedAt: new Date() })
          .where(eq(dnaModels.id, nextModel.id));
      }
    }
  });

  const models = await db
    .select()
    .from(dnaModels)
    .where(eq(dnaModels.userId, userId))
    .orderBy(desc(dnaModels.createdAt));

  return NextResponse.json({ deleted: true, models });
}
