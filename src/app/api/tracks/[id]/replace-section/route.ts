import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { createApimartSectionReplacement } from "@/lib/providers/apimart";
import { apimartAudioIndexForJobId } from "@/lib/apimart-wav";
import { logApi } from "@/lib/logger";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now();
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const [track] = await db.select().from(tracks).where(and(eq(tracks.id, id), eq(tracks.userId, auth.userId)));
  if (!track) return NextResponse.json({ error: "Track not found" }, { status: 404 });
  if (track.provider !== "apimart" || !track.jobId) return NextResponse.json({ error: "Section replacement is only available for APIMart tracks" }, { status: 400 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const startSeconds = typeof body?.startSeconds === "number" ? body.startSeconds : NaN;
  const endSeconds = typeof body?.endSeconds === "number" ? body.endSeconds : NaN;
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || startSeconds < 0 || endSeconds <= startSeconds) {
    return NextResponse.json({ error: "Choose a valid section to replace" }, { status: 400 });
  }

  try {
    const version = ["v4", "v4.5+", "v5", "v5.5"].includes(track.providerModel) ? track.providerModel : "v5.5";
    const result = await createApimartSectionReplacement({
      taskId: track.jobId.split(":")[0], audioIndex: apimartAudioIndexForJobId(track.jobId), startSeconds, endSeconds, version,
      infillLyrics: typeof body?.infillLyrics === "string" ? body.infillLyrics : undefined,
      prompt: typeof body?.prompt === "string" ? body.prompt : track.lyrics ?? undefined,
      title: track.title ?? undefined, tags: track.prompt,
    });
    const [replacement] = await db.insert(tracks).values({
      userId: auth.userId, workspaceId: track.workspaceId, title: `${track.title ?? "Untitled"} (section edit)`, provider: "apimart", providerModel: version,
      prompt: track.prompt, lyrics: track.lyrics, instrumental: track.instrumental, status: "generating", jobId: result.taskId,
      artistName: track.artistName, composerName: track.composerName, writerName: track.writerName,
    }).returning();
    await logApi({ userId: auth.userId, type: "generation", provider: "apimart", endpoint: "/api/tracks/[id]/replace-section", request: JSON.stringify({ trackId: id, startSeconds, endSeconds }), response: JSON.stringify({ taskId: result.taskId }), statusCode: 200, duration: Date.now() - startedAt });
    return NextResponse.json(replacement);
  } catch (error: any) {
    const message = error?.message || "Section replacement failed";
    return NextResponse.json({ error: message }, { status: error?.statusCode || 500 });
  }
}
