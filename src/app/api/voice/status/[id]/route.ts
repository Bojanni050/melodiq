import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clonedVoices } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { getApimartTaskStatus } from "@/lib/providers/apimart";

// The APIMart createVoice docs don't pin down the exact field name for the
// resulting persona id — probe the likely candidates and log the raw result
// the first time a task completes, so we can confirm which one it actually is.
function extractPersonaId(result: any): string | null {
  if (!result || typeof result !== "object") return null;
  return (
    result.persona_id ??
    result.audio_id ??
    result.voice_id ??
    result.id ??
    (Array.isArray(result.music) ? result.music[0]?.audio_id ?? result.music[0]?.id : null) ??
    null
  );
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

    if (status.status === "completed") {
      console.log(`[voice/status] APIMart createVoice completed for ${voice.id}, raw result:`, JSON.stringify(status.rawResult));

      const personaId = extractPersonaId(status.rawResult);
      const updated = await db
        .update(clonedVoices)
        .set({
          status: personaId ? "completed" : "failed",
          personaId,
          error: personaId ? null : "APIMart did not return a usable persona id",
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
