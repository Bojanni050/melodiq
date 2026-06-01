/**
 * POST /api/tracks/recover-musicgpt
 *
 * Recovers MusicGPT tracks stuck on "generating" by polling the
 * MusicGPT GET /v1/byId endpoint for each track using its conversionId.
 *
 * Works for both track 1 (conversionId1) and track 2 (conversionId2)
 * because each has its own conversionId stored in the DB.
 *
 * Usage: call this manually from Settings or a one-off script.
 * Safe to call multiple times — skips tracks already done/failed.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { and, eq, isNotNull, or } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { getSetting } from "@/lib/settings";
import { uploadToS3 } from "@/lib/s3";
import { extractAudioDuration } from "@/lib/audio-duration";
import { generateAndSaveCoverArt } from "@/lib/generate-cover";
import { logApi } from "@/lib/logger";
import axios from "axios";

interface MusicGptConversion {
  task_id: string;
  conversion_id?: string;
  conversion_id_1?: string;
  conversion_id_2?: string;
  status: string;
  status_msg?: string;
  message?: string;
  audio_url?: string;
  conversion_path?: string;
  conversion_path_1?: string;
  conversion_path_2?: string;
  conversion_path_wav_1?: string;
  conversion_path_wav_2?: string;
  album_cover_path?: string;
  conversion_duration_1?: number;
  conversion_duration_2?: number;
  title?: string;
  lyrics?: string;
  lyrics_timestamped_1?: string;
  lyrics_timestamped_2?: string;
  music_style?: string;
}

async function fetchConversionById(
  conversionId: string,
  apiKey: string
): Promise<MusicGptConversion | null> {
  try {
    const response = await axios.get(
      "https://api.musicgpt.com/api/public/v1/byId",
      {
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        params: {
          conversionType: "MUSIC_AI",
          conversion_id: conversionId,
        },
        timeout: 15000,
      }
    );

    if (response.data?.success && response.data?.conversion) {
      return response.data.conversion as MusicGptConversion;
    }
    return null;
  } catch (error: any) {
    console.warn(
      `[recover-musicgpt] byId fetch failed for ${conversionId}:`,
      error.message
    );
    return null;
  }
}

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const apiKey =
    (await getSetting("MUSICGPT_API_KEY")) ||
    process.env.MUSICGPT_API_KEY ||
    "";

  if (!apiKey) {
    return NextResponse.json(
      { error: "MUSICGPT_API_KEY not configured" },
      { status: 400 }
    );
  }

  // Find all MusicGPT tracks stuck on "generating" that have a conversionId
  const stuckTracks = await db
    .select()
    .from(tracks)
    .where(
      and(
        eq(tracks.userId, userId),
        eq(tracks.provider, "musicgpt"),
        or(
          eq(tracks.status, "generating"),
          eq(tracks.status, "failed")
        ),
        isNotNull(tracks.conversionId)
      )
    );

  if (stuckTracks.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No recoverable MusicGPT tracks found",
      recovered: 0,
      total: 0,
    });
  }

  console.log(
    `[recover-musicgpt] found ${stuckTracks.length} stuck track(s) for user ${userId}`
  );

  const results: {
    trackId: string;
    conversionId: string;
    outcome: "recovered" | "still_processing" | "failed" | "no_audio";
    detail?: string;
  }[] = [];

  for (const track of stuckTracks) {
    const conversionId = track.conversionId!;

    const conversion = await fetchConversionById(conversionId, apiKey);

    if (!conversion) {
      results.push({
        trackId: track.id!,
        conversionId,
        outcome: "failed",
        detail: "Could not fetch conversion from MusicGPT API",
      });
      continue;
    }

    const status = (conversion.status ?? "").toUpperCase();
    const audioUrl =
      conversion.audio_url ??
      conversion.conversion_path_1 ??
      conversion.conversion_path ??
      null;

    if (status === "COMPLETED" && audioUrl) {
      try {
        console.log(
          `[recover-musicgpt] downloading audio for track ${track.id} from ${audioUrl}`
        );

        const audioRes = await axios.get(audioUrl, {
          responseType: "arraybuffer",
          timeout: 60000,
        });
        const audioBuffer = Buffer.from(audioRes.data);
        const s3Key = `tracks/${track.id}/audio.mp3`;
        await uploadToS3(s3Key, audioBuffer, "audio/mpeg");

        const duration = await extractAudioDuration(audioBuffer);

        // Retrieve WAV and timestamps from conversion details
        const isTrack1 = track.conversionId === conversion.conversion_id_1;
        const isTrack2 = track.conversionId === conversion.conversion_id_2;

        const wavUrl = isTrack1
          ? conversion.conversion_path_wav_1
          : isTrack2
            ? conversion.conversion_path_wav_2
            : (conversion.conversion_path_wav_1 || conversion.conversion_path_wav_2);

        const rawTimestamps = isTrack1
          ? conversion.lyrics_timestamped_1
          : conversion.lyrics_timestamped_2 || conversion.lyrics_timestamped_1;

        let s3KeyHd: string | null = null;
        let formatHd: string | null = null;
        let audioUrlHd: string | null = null;
        let lyricsTimestamps: string | null = null;

        if (wavUrl) {
          try {
            console.log(`[recover-musicgpt] downloading WAV audio for track ${track.id} from ${wavUrl}`);
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
            console.error(`[recover-musicgpt] WAV S3 upload failed for track ${track.id}:`, wavErr?.message ?? wavErr);
          }
        }

        if (rawTimestamps) {
          try {
            lyricsTimestamps = typeof rawTimestamps === "string"
              ? rawTimestamps
              : JSON.stringify(rawTimestamps);
          } catch {}
        }

        await db
          .update(tracks)
          .set({
            status: "done",
            s3Key,
            duration,
            audioUrl: `/api/tracks/${track.id}/download`,
            error: null,
            ...(s3KeyHd ? { s3KeyHd, formatHd, audioUrlHd } : {}),
            ...(lyricsTimestamps ? { lyricsTimestamps } : {}),
          })
          .where(eq(tracks.id, track.id!));

        // Fire-and-forget cover art if not already present
        if (!track.s3KeyCover) {
          generateAndSaveCoverArt({
            id: track.id,
            userId: track.userId,
            title: track.title,
            prompt: track.prompt,
            instrumental: track.instrumental,
          }).catch((error) => console.error("[recover-musicgpt] cover art generation failed", error));
        }

        await logApi({
          userId: track.userId,
          type: "webhook",
          provider: "musicgpt",
          endpoint: "/api/tracks/recover-musicgpt",
          request: JSON.stringify({ conversionId }),
          response: JSON.stringify({ trackId: track.id, outcome: "recovered" }),
          statusCode: 200,
        });

        results.push({
          trackId: track.id!,
          conversionId,
          outcome: "recovered",
          detail: `Audio saved to S3, duration: ${duration}ms`,
        });
      } catch (error: any) {
        console.error(
          `[recover-musicgpt] failed to save audio for track ${track.id}:`,
          error.message
        );

        await db
          .update(tracks)
          .set({
            status: "failed",
            error: `Recovery failed: ${error.message}`,
          })
          .where(eq(tracks.id, track.id!));

        results.push({
          trackId: track.id!,
          conversionId,
          outcome: "failed",
          detail: error.message,
        });
      }
    } else if (status === "FAILED" || status.includes("FAIL")) {
      await db
        .update(tracks)
        .set({
          status: "failed",
          error: conversion.status_msg || "Generation failed (recovered)",
        })
        .where(eq(tracks.id, track.id!));

      results.push({
        trackId: track.id!,
        conversionId,
        outcome: "failed",
        detail: conversion.status_msg || "FAILED status from API",
      });
    } else if (!audioUrl && status === "COMPLETED") {
      // COMPLETED but no audio_url — unusual
      results.push({
        trackId: track.id!,
        conversionId,
        outcome: "no_audio",
        detail: "Status COMPLETED but no audio_url returned",
      });
    } else {
      // Still processing
      results.push({
        trackId: track.id!,
        conversionId,
        outcome: "still_processing",
        detail: `Status: ${conversion.status}`,
      });
    }
  }

  const recoveredCount = results.filter((r) => r.outcome === "recovered").length;
  const failedCount = results.filter((r) => r.outcome === "failed").length;
  const processingCount = results.filter(
    (r) => r.outcome === "still_processing"
  ).length;

  return NextResponse.json({
    success: true,
    message: `Recovered ${recoveredCount}/${stuckTracks.length} tracks`,
    recovered: recoveredCount,
    failed: failedCount,
    still_processing: processingCount,
    total: stuckTracks.length,
    results,
  });
}
