import { NextRequest } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateAndSaveCoverArt } from "@/lib/generate-cover";
import { logApi } from "@/lib/logger";
import { extractAudioDuration } from "@/lib/audio-duration";
import { sendPushNotification } from "@/lib/push";

type MusicGptWebhookPayload = Record<string, unknown>;

function isRecord(value: unknown): value is MusicGptWebhookPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(body: MusicGptWebhookPayload, keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function getBoolean(body: MusicGptWebhookPayload, key: string) {
  const value = body[key];
  return typeof value === "boolean" ? value : undefined;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret =
    searchParams.get("secret") ||
    request.headers.get("x-webhook-secret");

  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  let body: MusicGptWebhookPayload;
  try {
    const parsed = await request.json();
    if (!isRecord(parsed)) {
      return new Response("invalid json", { status: 400 });
    }
    body = parsed;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  console.log("[webhook/musicgpt] received:", JSON.stringify(body));

  // MusicGPT webhook payload fields (from official docs):
  // task_id - shared across both tracks of a generation
  // conversion_id - unique per track variant (matches conversion_id_1 / conversion_id_2 from generate response)
  // status - "COMPLETED" | "FAILED" on generic callbacks, but can be absent for MusicAI
  // audio_url/conversion_path - direct audio URL to the generated mp3
  // conversion_type - "Music AI" | "Lyrics" | "Image" etc; skip non-audio payloads
  const taskId: string | undefined =
    getString(body, ["task_id", "taskId"]);
  const conversionId: string | undefined =
    getString(body, ["conversion_id", "conversionId", "conversion_id_1"]);
  const conversionType: string | undefined =
    getString(body, ["conversion_type", "conversionType", "feature"]);
  const status: string =
    (getString(body, ["status", "status_msg", "message"]) ?? "").toUpperCase();
  const success = getBoolean(body, "success");
  const audioUrl: string | undefined =
    getString(body, [
      "audio_url",
      "audioUrl",
      "conversion_path",
      "conversion_path_1",
      "conversion_path_2",
    ]);

  if (!taskId) {
    console.error("[webhook/musicgpt] missing task_id in payload");
    return new Response("missing task_id", { status: 400 });
  }

  // MusicGPT sends multiple webhooks per generation:
  // - 2x Music conversion (one per variant): these have audio_url or conversion_path
  // - 2x Lyrics with timestamps: no audio_url, conversion_type contains "Lyrics"
  // - 1x Album cover image: no audio_url, conversion_type contains "Image"
  // Skip non-audio webhooks early to avoid unnecessary DB lookups.
  if (conversionType) {
    const type = conversionType.toUpperCase();
    if (
      !audioUrl &&
      (type.includes("LYRIC") || type.includes("IMAGE") || type.includes("COVER") || type.includes("ALBUM"))
    ) {
      console.log(`[webhook/musicgpt] skipping non-audio webhook (type=${conversionType})`);
      return new Response("success", { status: 200 });
    }
  }

  // Look up all tracks sharing this task_id (always 2 for MusicGPT Music AI)
  const result = await db
    .select()
    .from(tracks)
    .where(eq(tracks.jobId, taskId));

  if (result.length === 0) {
    console.error(`[webhook/musicgpt] no track found for task_id: ${taskId}`);
    // Return 200 so MusicGPT doesn't keep retrying for unknown tasks
    return new Response("success", { status: 200 });
  }

  // Select the correct track variant using conversion_id.
  // conversion_id_1 / conversion_id_2 from the generate response are stored
  // in the tracks table as conversionId for track 1 and track 2 respectively.
  // Without this, result[0] would always update the same track and track 2
  // would remain stuck on "generating" indefinitely.
  const conversionMatch = conversionId
    ? result.find((t) => t.conversionId === conversionId)
    : undefined;
  const track = conversionMatch ?? result[0];

  const matchedBy = conversionId
    ? (conversionMatch ? "conversionId" : "jobId-fallback")
    : "jobId-only";

  console.log(
    `[webhook/musicgpt] matched track ${track.id} via ${matchedBy} ` +
    `(conversionId=${conversionId ?? "none"}, taskId=${taskId})`
  );

  const failed =
    success === false ||
    status === "FAILED" ||
    status.includes("FAIL");

  if (audioUrl && !failed) {
    try {
      // Mark done immediately with CDN URL so the user can start listening
      // while the S3 upload runs in the background.
      await db
        .update(tracks)
        .set({
          status: "done",
          audioUrl,
        })
        .where(eq(tracks.id, track.id!));

      // Fire-and-forget cover art if not already present.
      if (!track.s3KeyCover) {
        generateAndSaveCoverArt({
          id: track.id,
          userId: track.userId,
          title: track.title,
          prompt: track.prompt,
          instrumental: track.instrumental,
          lyrics: track.lyrics,
        }).catch((error) => console.error("[webhook/musicgpt] cover art generation failed", error));
      }

      await logApi({
        userId: track.userId,
        type: "webhook",
        provider: "musicgpt",
        endpoint: "/api/webhooks/musicgpt",
        request: JSON.stringify(body),
        response: JSON.stringify({ trackId: track.id, matchedBy, conversionId }),
        statusCode: 200,
      });

      console.log(`[webhook/musicgpt] track ${track.id} done (matchedBy=${matchedBy}), uploading to S3 in background`);
      sendPushNotification(track.userId, {
        title: "Track klaar",
        body: track.title ? `"${track.title}" is klaar met genereren.` : "Je track is klaar met genereren.",
        url: "/library",
      }).catch(() => {});

      // Upload to S3 in background and swap URL when done
      (async () => {
        try {
          const axios = (await import("axios")).default;
          const { uploadToS3 } = await import("@/lib/s3");
          const { getMusicGptConversionById } = await import("@/lib/providers/musicgpt");

          const audioRes = await axios.get(audioUrl, {
            responseType: "arraybuffer",
            timeout: 60000,
          });
          const audioBuffer = Buffer.from(audioRes.data);
          const s3Key = `tracks/${track.id}/audio.mp3`;
          await uploadToS3(s3Key, audioBuffer);
          const duration = await extractAudioDuration(audioBuffer);

          // Retrieve WAV and timestamps from full conversion details
          let s3KeyHd: string | null = null;
          let formatHd: string | null = null;
          let audioUrlHd: string | null = null;
          let lyricsTimestamps: string | null = null;

          if (track.conversionId) {
            try {
              const conversion = await getMusicGptConversionById(track.conversionId);
              if (conversion) {
                const isTrack1 = track.conversionId === conversion.conversion_id_1;
                const isTrack2 = track.conversionId === conversion.conversion_id_2;

                const wavUrl = isTrack1
                  ? conversion.conversion_path_wav_1
                  : isTrack2
                    ? conversion.conversion_path_wav_2
                    : (conversion.conversion_path_wav_1 || conversion.conversion_path_wav_2);

                const rawTimestamps = isTrack1
                  ? conversion.lyrics_timestamped_1
                  : (conversion as any).lyrics_timestamped_2 || conversion.lyrics_timestamped_1;

                if (wavUrl) {
                  try {
                    console.log(`[webhook/musicgpt] downloading WAV audio for track ${track.id} from ${wavUrl}`);
                    const wavRes = await axios.get(wavUrl, {
                      responseType: "arraybuffer",
                      timeout: 60000,
                    });
                    const wavBuffer = Buffer.from(wavRes.data);
                    s3KeyHd = `tracks/${track.id}/audio_hd.wav`;
                    await uploadToS3(s3KeyHd, wavBuffer, "audio/wav");
                    formatHd = "wav";
                    audioUrlHd = `/api/tracks/${track.id}/download?hd=true`;
                  } catch (wavErr: any) {
                    console.error(`[webhook/musicgpt] background WAV S3 upload failed for track ${track.id}:`, wavErr?.message ?? wavErr);
                  }
                }

                if (rawTimestamps) {
                  try {
                    lyricsTimestamps = typeof rawTimestamps === "string"
                      ? rawTimestamps
                      : JSON.stringify(rawTimestamps);
                  } catch {}
                }
              }
            } catch (convErr: any) {
              console.warn(`[webhook/musicgpt] failed to fetch conversion details for track ${track.id}:`, convErr.message);
            }
          }

          await db
            .update(tracks)
            .set({
              s3Key,
              duration,
              audioUrl: `/api/tracks/${track.id}/download`,
              ...(s3KeyHd ? { s3KeyHd, formatHd, audioUrlHd } : {}),
              ...(lyricsTimestamps ? { lyricsTimestamps } : {}),
            })
            .where(eq(tracks.id, track.id!));
        } catch (err: any) {
          console.error(`[webhook/musicgpt] background S3 upload failed for track ${track.id}:`, err?.message ?? err);
        }
      })();

      return new Response("success", { status: 200 });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      console.error("[webhook/musicgpt] failed:", message);
      await db
        .update(tracks)
        .set({ status: "failed", error: `Processing failed: ${message}` })
        .where(eq(tracks.id, track.id!));
      return new Response("success", { status: 200 });
    }
  }

  if (failed) {
    await db
      .update(tracks)
      .set({
        status: "failed",
        error: getString(body, ["status_msg", "message", "reason"]) || "Generation failed",
      })
      .where(eq(tracks.id, track.id!));

    await logApi({
      userId: track.userId,
      type: "webhook",
      provider: "musicgpt",
      endpoint: "/api/webhooks/musicgpt",
      request: JSON.stringify(body),
      response: JSON.stringify({ trackId: track.id, status: "failed" }),
      statusCode: 200,
    });

    sendPushNotification(track.userId, {
      title: "Generatie mislukt",
      body: track.title ? `"${track.title}" kon niet worden gegenereerd.` : "Een track kon niet worden gegenereerd.",
      url: "/library",
    }).catch(() => {});

    return new Response("success", { status: 200 });
  }

  // Still processing; just acknowledge.
  console.log(`[webhook/musicgpt] task ${taskId} status=${status || "unknown"}, waiting...`);
  return new Response("success", { status: 200 });
}
