import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { stylePresets } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  await db
    .delete(stylePresets)
    .where(and(eq(stylePresets.id, id), eq(stylePresets.userId, auth.userId)));

  return NextResponse.json({ ok: true });
}
