import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clonedVoices } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";

const MAX_NAME_LENGTH = 120;

/**
 * Renames a cloned voice. The name is only a label for picking a voice in the
 * Studio — it is never sent to APIMart, which keeps its own persona id.
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
  if (typeof body?.name !== "string") {
    return NextResponse.json({ error: "A name is required" }, { status: 400 });
  }

  const name = body.name.trim();
  if (!name) {
    return NextResponse.json({ error: "A name is required" }, { status: 400 });
  }
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: `Keep the name under ${MAX_NAME_LENGTH} characters` },
      { status: 400 }
    );
  }

  const updated = await db
    .update(clonedVoices)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(clonedVoices.id, id), eq(clonedVoices.userId, userId)))
    .returning();

  if (updated.length === 0) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  }

  return NextResponse.json({ voice: updated[0] });
}
