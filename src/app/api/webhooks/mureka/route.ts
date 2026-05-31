import { NextRequest } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { logApi } from "@/lib/logger";
import { extractAudioDuration } from "@/lib/audio-duration";
import { createHmac } from "crypto";

function verifySignature(request: NextRequest, rawBody: string): boolean {
  const webhookSecret = process.env.WAVESPEED_WEBHOOK_SECRET;
  if (!webhookSecret) return true; // skip verification if not configured

  const webhookId = request.headers.get("webhook-id") ?? "";
  const webhookTimestamp = request.headers.get("webhook-timestamp") ?? "";
  const webhookSignature = request.headers.get("webhook-signature") ?? "";

  // Strip whsec_ prefix but do NOT base64 decode — use as-is per WaveSpeed docs
  const secret = webhookSecret.startsWith("whsec_")
    ? webhookSecret.slice("whsec_".length)
    : webhookSecret;

  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const computed = createHmac("sha256", secret)
    .update(signedContent)
    .digest("hex");

  const expectedSig = `v3,${computed}`;
  return webhookSignature.split(" ").some((sig) => sig === expectedSig);
}
function extractOutputs(body: any): string[] {
  if (!body || typeof body !== "object") return [];

  // Helper to extract URLs from a single value (string, object, array)
  function extractFromValue(val: any): string[] {
    if (!val) return [];
    if (typeof val === "string") {
      if (val.startsWith("http") || val.startsWith("/")) {
        return [val];
      }
      return [];
    }
    if (Array.isArray(val)) {
      return val.flatMap(extractFromValue);
    }
    if (typeof val === "object") {
      const urlCandidates = [
        val.url,
        val.audio_url,
        val.audioUrl,
        val.wav_url,
        val.wavUrl,
        val.file,
      ];
      for (const cand of urlCandidates) {
        if (typeof cand === "string" && (cand.startsWith("http") || cand.startsWith("/"))) {
          return [cand];
        }
      }
      // If it's some other object, search values shallowly
      return Object.values(val).flatMap(extractFromValue);
    }
    return [];
  }

  // Try all potential result fields in the webhook body
  const fieldsToTry = [
    body.output,
    body.outputs,
    body.data?.output,
    body.data?.outputs,
    body.result,
    body.results,
    body.data?.result,
    body.data?.results,
    body.prediction?.output,
    body.prediction?.outputs,
  ];

  for (const field of fieldsToTry) {
    const found = extractFromValue(field);
    if (found.length > 0) {
      return found;
    }
  }

  // Fallback: search the entire body
  return extractFromValue(body);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  if (!verifySignature(request, rawBody)) {
    return new Response("forbidden", { status: 403 });
  }

  const requestId =
    typeof body.id === "string"
      ? body.id
      : typeof body.prediction_id === "string"
      ? body.prediction_id
      : typeof body.predictionId === "string"
      ? body.predictionId
      : typeof (body.data as any)?.id === "string"
      ? (body.data as any).id
      : null;

  const status = typeof body.status === "string" ? body.status.toLowerCase() : "";
  const outputs = extractOutputs(body);

  console.log(`[webhook/mureka] received: id=${requestId} status=${status} outputs=${outputs.length}`);

  if (!requestId) {
    return new Response("missing id", { status: 400 });
  }

  if (status === "failed" || status === "error") {
    const errorMsg = typeof body.error === "string" ? body.error : "Mureka generation failed";
    const variantTracks = await db.select().from(tracks).where(
      or(eq(tracks.jobId, requestId), eq(tracks.jobId, `${requestId}:1`))
    );
    await Promise.allSettled(
      variantTracks.map((t) =>
        db.update(tracks).set({ status: "failed", error: errorMsg }).where(eq(tracks.id, t.id!))
      )
    );
    return new Response("success", { status: 200 });
  }

  if ((status === "succeeded" || status === "completed" || status === "done") && outputs.length > 0) {
    const variantTracks = await db.select().from(tracks).where(
      or(eq(tracks.jobId, requestId), eq(tracks.jobId, `${requestId}:1`))
    );

    await Promise.allSettled(
      variantTracks.map(async (track, idx) => {
        const audioUrl = outputs[idx] ?? outputs[0];
        if (!audioUrl) return;

        // Mark done immediately with CDN URL
        await db.update(tracks).set({ status: "done", audioUrl, format: "mp3" }).where(eq(tracks.id, track.id!));

        // Upload to S3 in background
        (async () => {
          try {
            const axios = (await import("axios")).default;
            const { uploadToS3 } = await import("@/lib/s3");
            const res = await axios.get(audioUrl, { responseType: "arraybuffer", timeout: 60000 });
            const buf = Buffer.from(res.data);
            const s3Key = `tracks/${track.id}/audio.mp3`;
            await uploadToS3(s3Key, buf, "audio/mpeg");
            const duration = await extractAudioDuration(buf);
            await db.update(tracks).set({ s3Key, duration, audioUrl: `/api/tracks/${track.id}/download` }).where(eq(tracks.id, track.id!));
            console.log(`[webhook/mureka] track ${track.id} S3 upload complete`);
          } catch (err: any) {
            console.error(`[webhook/mureka] S3 upload failed for track ${track.id}:`, err?.message);
          }
        })();
      })
    );

    await logApi({
      userId: variantTracks[0]?.userId ?? "unknown",
      type: "webhook",
      provider: "mureka",
      endpoint: "/api/webhooks/mureka",
      request: JSON.stringify({ id: requestId, status, outputs: outputs.length }),
      response: JSON.stringify({ synced: variantTracks.length }),
      statusCode: 200,
    });

    console.log(`[webhook/mureka] ${variantTracks.length} tracks marked done (requestId=${requestId})`);
  }

  return new Response("success", { status: 200 });
}
