import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clonedVoices } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";

const MAX_NAME_LENGTH = 120;
const MAX_STYLES_LENGTH = 200;
const MAX_DESCRIBE_LENGTH = 1000;

/**
 * Edits a cloned voice's labels. `name` is the picker label in the Studio,
 * `styles` and `describe` are the descriptors APIMart stored on the persona.
 * None of them is ever re-sent to APIMart when a track is generated — only the
 * persona id is — so editing here cannot change the voice itself.
 *
 * Any subset may be sent, but at least one field has to be present. Sending an
 * empty `styles`/`describe` clears it; an empty `name` is refused because it
 * would leave an unlabelable row in the picker.
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
  const updates: Partial<{ name: string; styles: string | null; describe: string | null }> = {};

  if (body && typeof body === "object" && "name" in body) {
    if (typeof body.name !== "string") {
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
    updates.name = name;
  }

  if (body && typeof body === "object" && "styles" in body) {
    if (body.styles !== null && typeof body.styles !== "string") {
      return NextResponse.json({ error: "Styles must be text" }, { status: 400 });
    }
    const styles = typeof body.styles === "string" ? body.styles.trim() : "";
    updates.styles = styles ? styles.slice(0, MAX_STYLES_LENGTH) : null;
  }

  if (body && typeof body === "object" && "describe" in body) {
    if (body.describe !== null && typeof body.describe !== "string") {
      return NextResponse.json({ error: "Describe must be text" }, { status: 400 });
    }
    const describe = typeof body.describe === "string" ? body.describe.trim() : "";
    updates.describe = describe ? describe.slice(0, MAX_DESCRIBE_LENGTH) : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await db
    .update(clonedVoices)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(clonedVoices.id, id), eq(clonedVoices.userId, userId)))
    .returning();

  if (updated.length === 0) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  }

  return NextResponse.json({ voice: updated[0] });
}

/**
 * Removes a voice from MelodIQ. APIMart has no documented delete endpoint for
 * personas, so this only forgets the local row (and the persona id with it);
 * whatever APIMart keeps on its side is no longer reachable from here.
 *
 * When the deleted row was the selected voice, the newest remaining completed
 * voice takes the selection so the Studio keeps sending a persona instead of
 * quietly falling back to none. The response carries the refreshed list.
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
    .from(clonedVoices)
    .where(and(eq(clonedVoices.id, id), eq(clonedVoices.userId, userId)));

  if (rows.length === 0) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  }

  const deleted = rows[0];

  await db.transaction(async (tx) => {
    await tx
      .delete(clonedVoices)
      .where(and(eq(clonedVoices.id, id), eq(clonedVoices.userId, userId)));

    if (deleted.isSelected) {
      const [nextVoice] = await tx
        .select({ id: clonedVoices.id })
        .from(clonedVoices)
        .where(and(eq(clonedVoices.userId, userId), eq(clonedVoices.status, "completed")))
        .orderBy(desc(clonedVoices.createdAt))
        .limit(1);

      if (nextVoice) {
        await tx
          .update(clonedVoices)
          .set({ isSelected: true, updatedAt: new Date() })
          .where(eq(clonedVoices.id, nextVoice.id));
      }
    }
  });

  const voices = await db
    .select()
    .from(clonedVoices)
    .where(eq(clonedVoices.userId, userId))
    .orderBy(desc(clonedVoices.createdAt));

  return NextResponse.json({ deleted: true, voices });
}
