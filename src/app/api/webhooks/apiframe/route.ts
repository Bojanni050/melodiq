import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, or, and } from "drizzle-orm";
import { logApi } from "@/lib/logger";
import { sendPushNotification } from "@/lib/push";
import { extractAudioDuration } from "@/lib/audio-duration";
import { detectAndSaveLanguageIfMissing } from "@/lib/language-detect";

function extractAudioUrls(body: any): string[] {
  if (!body || typeof body !== "object") return [];
  const urls: string[] = [];

  // 1. Check result.tracks
  const tracksList = body.result?.tracks || body.tracks;
  if (Array.isArray(tracksList)) {
    for (const t of tracksList) {
      if (t?.audioUrl) urls.push(t.audioUrl);
      else if (t?.url) urls.push(t.url);
      else if (t?.audio_url) urls.push(t.audio_url);
    }
  }

  // 2. Check songs
  const songs = body.result?.songs || body.songs;
  if (Array.isArray(songs)) {
    for (const s of songs) {
      if (s?.audioUrl) urls.push(s.audioUrl);
      else if (s?.audio_url) urls.push(s.audio_url);
      else if (s?.url) urls.push(s.url);
    }
  }

  // 3. Fallback: recursively scan for any URL starting with http containing audio extensions or /audio/
  if (urls.length === 0) {
    const scan = (val: any) => {
      if (typeof val === "string") {
        if (val.startsWith("http") && (val.includes(".mp3") || val.includes(".wav") || val.includes("/audio/"))) {
          urls.push(val);
        }
      } else if (Array.isArray(val)) {
        val.forEach(scan);
      } else if (typeof val === "object" && val !== null) {
        Object.values(val).forEach(scan);
      }
    };
    scan(body);
  }

  return urls;
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  console.log("[webhook/apiframe] received:", JSON.stringify(body));

  const jobId = body.jobId || body.id || body.task_id;
  const status = (body.status || "").toLowerCase();

  if (!jobId) {
    return new Response("missing jobId", { status: 400 });
  }

  const variantTracks = await db
    .select()
    .from(tracks)
    .where(
      and(
        or(eq(tracks.jobId, jobId), eq(tracks.jobId, `${jobId}:1`)),
        eq(tracks.provider, "apiframe")
      )
    );

  if (variantTracks.length === 0) {
    console.error(`[webhook/apiframe] no tracks found for jobId: ${jobId}`);
    return new Response("success", { status: 200 });
  }

  const isCompleted = status === "completed" || status === "succeeded" || status === "done" || status === "finished";
  const isFailed = status === "failed" || status === "error";

  if (isFailed) {
    const errorMsg = body.error || "Generation failed";
    await Promise.allSettled(
      variantTracks.map((t) =>
        db.update(tracks).set({ status: "failed", error: errorMsg }).where(eq(tracks.id, t.id!))
      )
    );

    const firstTrack = variantTracks[0];
    sendPushNotification(firstTrack.userId, {
      title: "Generatie mislukt",
      body: firstTrack.title ? `"${firstTrack.title}" kon niet worden gegenereerd.` : "Een track kon niet worden gegenereerd.",
      url: "/library",
    }).catch(() => {});

    return new Response("success", { status: 200 });
  }

  if (isCompleted) {
    const outputs = extractAudioUrls(body);
    if (outputs.length === 0) {
      await Promise.allSettled(
        variantTracks.map((t) =>
          db.update(tracks).set({ status: "failed", error: "No audio URLs returned" }).where(eq(tracks.id, t.id!))
        )
      );
      return new Response("success", { status: 200 });
    }

    await Promise.allSettled(
      variantTracks.map(async (track, idx) => {
        const audioUrl = outputs[idx] ?? outputs[0];
        if (!audioUrl) {
          await db
            .update(tracks)
            .set({ status: "failed", error: "No audio URL returned by provider" })
            .where(eq(tracks.id, track.id!));
          return;
        }

        if (!track.language) {
          detectAndSaveLanguageIfMissing({
            id: track.id!,
            language: track.language,
            lyrics: track.lyrics,
            instrumental: track.instrumental,
          }).catch((error) => console.error("[webhook/apiframe] language detection failed", error));
        }

        // Process download and S3 upload in the background
        (async () => {
          try {
            const axios = (await import("axios")).default;
            const { uploadToS3 } = await import("@/lib/s3");
            
            // Check if file is downloadable
            const res = await axios.get(audioUrl, { responseType: "arraybuffer", timeout: 60000 });
            const buf = Buffer.from(res.data);
            
            if (buf.length < 100) {
              throw new Error("Downloaded audio file is too small or invalid");
            }

            const s3Key = `tracks/${track.id}/audio.mp3`;
            await uploadToS3(s3Key, buf, "audio/mpeg");
            const duration = await extractAudioDuration(buf);
            
            // Set done status only after successful download and upload
            await db
              .update(tracks)
              .set({
                status: "done",
                s3Key,
                duration,
                format: "mp3",
                audioUrl: `/api/tracks/${track.id}/download`,
              })
              .where(eq(tracks.id, track.id!));
              
            console.log(`[webhook/apiframe] track ${track.id} downloaded and S3 upload complete`);
          } catch (err: any) {
            console.error(`[webhook/apiframe] download/upload failed for track ${track.id}:`, err?.message);
            await db
              .update(tracks)
              .set({
                status: "failed",
                error: `Failed to download audio from provider: ${err?.message || "unknown error"}`,
              })
              .where(eq(tracks.id, track.id!));
          }
        })();
      })
    );

    await logApi({
      userId: variantTracks[0].userId,
      type: "webhook",
      provider: "apiframe",
      endpoint: "/api/webhooks/apiframe",
      request: JSON.stringify(body),
      response: JSON.stringify({ synced: variantTracks.length }),
      statusCode: 200,
    });

    console.log(`[webhook/apiframe] ${variantTracks.length} tracks marked done`);
    sendPushNotification(variantTracks[0].userId, {
      title: "Track klaar",
      body: variantTracks[0].title ? `"${variantTracks[0].title}" is klaar met genereren.` : "Je track is klaar met genereren.",
      url: "/library",
    }).catch(() => {});
  }

  return new Response("success", { status: 200 });
}
