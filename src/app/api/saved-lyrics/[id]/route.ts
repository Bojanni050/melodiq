import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { savedLyrics } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  await db
    .delete(savedLyrics)
    .where(and(eq(savedLyrics.id, id), eq(savedLyrics.userId, auth.userId)));

  return NextResponse.json({ ok: true });
}
