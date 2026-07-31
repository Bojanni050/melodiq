import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks, trackStems } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { createApimartStems, getApimartRawTaskStatus } from "@/lib/providers/apimart";
import { apimartAudioIndexForJobId, extractApimartAudioUrl } from "@/lib/apimart-wav";
import { detectFormatFromUrl, detectFormatFromContentType, contentTypeForFormat } from "@/lib/audio-format";
import { uploadToS3 } from "@/lib/s3";
import { isValidStemType } from "@/lib/stem-types";
import { logApi } from "@/lib/logger";
import axios from "axios";

async function loadOwnedTrack(id: string, userId: string) {
  const result = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));
  return result[0] ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { id } = await params;
  const track = await loadOwnedTrack(id, userId);
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }
  if (track.provider !== "apimart" || !track.jobId) {
    return NextResponse.json({ error: "Stem extraction is only available for APIMart tracks" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const stemType = body && typeof body === "object" && "stemType" in body ? (body as { stemType: unknown }).stemType : undefined;
  if (!isValidStemType(stemType)) {
    return NextResponse.json({ error: "Invalid stemType" }, { status: 400 });
  }

  try {
    const parentJobId = track.jobId.split(":")[0];
    const audioIndex = apimartAudioIndexForJobId(track.jobId);
    const submitRes = await createApimartStems(parentJobId, audioIndex, stemType);

    const [stem] = await db
      .insert(trackStems)
      .values({
        trackId: track.id!,
        userId,
        stemType,
        status: "pending",
        jobId: submitRes.taskId,
      })
      .onConflictDoUpdate({
        target: [trackStems.trackId, trackStems.stemType],
        set: { status: "pending", jobId: submitRes.taskId, audioUrl: null, s3Key: null, error: null, updatedAt: new Date() },
      })
      .returning();

    await logApi({
      userId,
      type: "generation",
      provider: "apimart",
      endpoint: "/api/tracks/[id]/stems",
      request: JSON.stringify({ trackId: track.id, stemType }),
      response: JSON.stringify({ status: "pending", taskId: submitRes.taskId }),
      statusCode: 200,
      duration: Date.now() - startTime,
    });

    return NextResponse.json(stem);
  } catch (error: any) {
    const message = error?.message || "Stem extraction failed";
    await logApi({
      userId,
      type: "generation",
      provider: "apimart",
      endpoint: "/api/tracks/[id]/stems",
      request: JSON.stringify({ trackId: track.id, stemType }),
      response: JSON.stringify({ error: message }),
      statusCode: error?.statusCode || 500,
      duration: Date.now() - startTime,
    });
    return NextResponse.json({ error: message }, { status: error?.statusCode || 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { id } = await params;
  const track = await loadOwnedTrack(id, userId);
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const stems = await db
    .select()
    .from(trackStems)
    .where(eq(trackStems.trackId, track.id!));

  // Best-effort self-heal: check APIMart for any stem still pending and
  // finish it (download + upload to S3) before returning the list.
  for (const stem of stems) {
    if (stem.status !== "pending" || !stem.jobId) continue;
    try {
      const raw: any = await getApimartRawTaskStatus(stem.jobId);
      const statusValue = String(raw?.data?.status ?? "").toLowerCase();

      if (statusValue === "failed") {
        const [updated] = await db
          .update(trackStems)
          .set({ status: "failed", error: raw?.data?.error?.message || "Extraction failed", updatedAt: new Date() })
          .where(eq(trackStems.id, stem.id!))
          .returning();
        Object.assign(stem, updated);
        continue;
      }
      if (statusValue !== "completed" && statusValue !== "done") continue;

      const audioUrl = extractApimartAudioUrl(raw);
      if (!audioUrl) {
        const [updated] = await db
          .update(trackStems)
          .set({ status: "failed", error: "No audio URL in completed response", updatedAt: new Date() })
          .where(eq(trackStems.id, stem.id!))
          .returning();
        Object.assign(stem, updated);
        continue;
      }

      const audioRes = await axios.get(audioUrl, { responseType: "arraybuffer", timeout: 60000 });
      const audioBuffer = Buffer.from(audioRes.data);
      const headerType = String(audioRes.headers?.["content-type"] || "");
      const format = detectFormatFromUrl(audioUrl) !== "mp3" ? detectFormatFromUrl(audioUrl) : detectFormatFromContentType(headerType || "audio/mpeg");

      const s3Key = `tracks/${track.id}/stems/${stem.stemType}.${format}`;
      await uploadToS3(s3Key, audioBuffer, contentTypeForFormat(format));

      const [updated] = await db
        .update(trackStems)
        .set({ status: "completed", s3Key, format, audioUrl: `/api/tracks/${track.id}/stems/${stem.id}/download`, updatedAt: new Date() })
        .where(eq(trackStems.id, stem.id!))
        .returning();
      Object.assign(stem, updated);
    } catch (error: any) {
      console.error(`[stems] self-heal failed for stem ${stem.id}:`, error?.message ?? error);
    }
  }

  return NextResponse.json(stems);
}
