import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { analyzeAdvancedDna } from "@/lib/advanced-dna-analysis";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { id } = await params;

  const result = await db
    .select({ id: tracks.id, status: tracks.status })
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  if (result[0].status !== "done") {
    return NextResponse.json({ error: "Track isn't ready yet" }, { status: 400 });
  }

  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "true";

  const analysis = await analyzeAdvancedDna(id, { forceRefresh });
  if (!analysis) {
    return NextResponse.json({ error: "Advanced analysis failed" }, { status: 502 });
  }

  return NextResponse.json(analysis);
}