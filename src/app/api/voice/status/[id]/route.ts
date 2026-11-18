import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clonedVoices } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { getApimartTaskStatus } from "@/lib/providers/apimart";

// The APIMart createVoice docs don't pin down the exact field name for the
// resulting persona id — they explicitly warn that there is "no fixed
// result.voice_id response format". So probe the likely candidates, both at
// the top level and one level deeper, and log the raw result whenever a task
// completes so we can confirm which field it actually is.
function extractPersonaId(result: any): string | null {
  if (!result || typeof result !== "object") return null;

  const direct =
    result.persona_id ??
    result.personaId ??
    result.audio_id ??
    result.audioId ??
    result.voice_id ??
    result.voiceId ??
    result.id ??
    (Array.isArray(result.music) ? result.music[0]?.audio_id ?? result.music[0]?.id : null);

  if (typeof direct === "string" && direct) return direct;

  // Some responses nest the persona in a list or an object.
  const nested = [
    ...(Array.isArray(result.voices) ? result.voices : []),
    ...(Array.isArray(result.voice_list) ? result.voice_list : []),
    ...(Array.isArray(result.personas) ? result.personas : []),
    result.persona,
    result.voice,
  ].filter((entry) => entry && typeof entry === "object");

  for (const entry of nested) {
    const id =
      entry.persona_id ?? entry.personaId ?? entry.voice_id ?? entry.voiceId ?? entry.audio_id ?? entry.id;
    if (typeof id === "string" && id) return id;
  }

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const rows = await db
    .select()
    .from(clonedVoices)
    .where(and(eq(clonedVoices.id, id), eq(clonedVoices.userId, userId)));

  if (rows.length === 0) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  }

  const voice = rows[0];
  if (voice.status !== "pending") {
    return NextResponse.json({ voice });
  }

  try {
    const status = await getApimartTaskStatus(voice.apimartTaskId);

    // Log every poll, not just the successful one: a createVoice task that
    // never completes is the hard case to debug, and the raw payload is the
    // only thing that shows what APIMart actually returns.
    console.log(
      `[voice/status] task ${voice.apimartTaskId} → status=${status.status} raw=${JSON.stringify(status.rawResult ?? null)} error=${status.error ?? "none"}`
    );

    if (status.status === "completed") {
      const personaId = extractPersonaId(status.rawResult);

      // The first voice to complete selects itself, so a user with existing
      // clones keeps hearing their voice without touching a picker. Once a
      // selection exists it is never stolen — choosing is /api/voice/select.
      const existingSelection = personaId
        ? await db
            .select({ id: clonedVoices.id })
            .from(clonedVoices)
            .where(and(eq(clonedVoices.userId, userId), eq(clonedVoices.isSelected, true)))
            .limit(1)
        : [];

      const updated = await db
        .update(clonedVoices)
        .set({
          status: personaId ? "completed" : "failed",
          personaId,
          error: personaId ? null : "APIMart did not return a usable persona id",
          ...(personaId && existingSelection.length === 0 ? { isSelected: true } : {}),
          updatedAt: new Date(),
        })
        .where(eq(clonedVoices.id, voice.id))
        .returning();

      return NextResponse.json({ voice: updated[0] });
    }

    if (status.status === "failed") {
      const updated = await db
        .update(clonedVoices)
        .set({ status: "failed", error: status.error || "Voice cloning failed", updatedAt: new Date() })
        .where(eq(clonedVoices.id, voice.id))
        .returning();

      return NextResponse.json({ voice: updated[0] });
    }

    return NextResponse.json({ voice });
  } catch (e: any) {
    console.error(`[voice/status] polling failed for voice ${voice.id}:`, e?.message ?? e);
    return NextResponse.json({ voice });
  }
}
