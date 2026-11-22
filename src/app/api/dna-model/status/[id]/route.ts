import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { dnaModels } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { getApimartTaskStatus } from "@/lib/providers/apimart";

/**
 * The docs promise `data.result.model_id`, but the persona endpoint taught us
 * that APIMart does not always use the documented shape, so probe the likely
 * variants and log the raw result when a task completes.
 */
function extractModelId(result: any): string | null {
  if (!result || typeof result !== "object") return null;

  const direct = result.model_id ?? result.modelId ?? result.custom_model_id ?? result.customModelId;
  if (typeof direct === "string" && direct) return direct;

  const nested = [result.model, ...(Array.isArray(result.models) ? result.models : [])].filter(
    (entry) => entry && typeof entry === "object"
  );
  for (const entry of nested) {
    const id = entry.model_id ?? entry.modelId ?? entry.id;
    if (typeof id === "string" && id) return id;
  }

  return null;
}

export async function GET(
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

  const model = rows[0];
  if (model.status !== "pending") {
    return NextResponse.json({ model });
  }

  try {
    const status = await getApimartTaskStatus(model.apimartTaskId);

    console.log(
      `[dna-model/status] task ${model.apimartTaskId} → status=${status.status} raw=${JSON.stringify(status.rawResult ?? null)} error=${status.error ?? "none"}`
    );

    if (status.status === "completed") {
      const modelId = extractModelId(status.rawResult);

      // First completed model selects itself, mirroring cloned voices: the
      // Studio toggle is still the switch that decides whether it is used, so
      // this only saves a click in the settings list.
      const existingSelection = modelId
        ? await db
            .select({ id: dnaModels.id })
            .from(dnaModels)
            .where(and(eq(dnaModels.userId, userId), eq(dnaModels.isSelected, true)))
            .limit(1)
        : [];

      const updated = await db
        .update(dnaModels)
        .set({
          status: modelId ? "completed" : "failed",
          modelId,
          error: modelId ? null : "APIMart did not return a usable model id",
          ...(modelId && existingSelection.length === 0 ? { isSelected: true } : {}),
          updatedAt: new Date(),
        })
        .where(eq(dnaModels.id, model.id))
        .returning();

      return NextResponse.json({ model: updated[0] });
    }

    if (status.status === "failed") {
      const updated = await db
        .update(dnaModels)
        .set({ status: "failed", error: status.error || "Model training failed", updatedAt: new Date() })
        .where(eq(dnaModels.id, model.id))
        .returning();

      return NextResponse.json({ model: updated[0] });
    }

    return NextResponse.json({ model });
  } catch (error: any) {
    console.error(`[dna-model/status] polling failed for model ${model.id}:`, error?.message ?? error);
    return NextResponse.json({ model });
  }
}
