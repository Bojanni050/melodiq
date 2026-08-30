import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { positionCase } from "@/lib/reorder-positions";
import { coverImages } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body = await request.json().catch(() => null);
  const orderedIds: string[] | undefined = body?.orderedIds;

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds array required" }, { status: 400 });
  }

  // Verify all covers belong to this entity + user
  const covers = await db
    .select()
    .from(coverImages)
    .where(and(eq(coverImages.entityType, "track"), eq(coverImages.entityId, id), eq(coverImages.userId, userId)));

  const coverMap = new Map(covers.map((c) => [c.id, c]));
  for (const cid of orderedIds) {
    if (!coverMap.has(cid)) {
      return NextResponse.json({ error: `Cover ${cid} not found` }, { status: 400 });
    }
  }

  // Update positions
  // One statement rather than a round-trip per cover. There is no unique
  // constraint on (entity, position) here, so the new order can be applied
  // in a single pass.
  await db
    .update(coverImages)
    .set({
      position: positionCase(coverImages.id, orderedIds),
    })
    .where(inArray(coverImages.id, orderedIds));

  return NextResponse.json({ success: true });
}
