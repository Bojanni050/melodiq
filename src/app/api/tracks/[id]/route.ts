import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks, workspaces } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getPresignedUrl, deleteFromS3 } from "@/lib/s3";
import { getPoYoStatus } from "@/lib/providers/poyo";
import { getTempolorStatus } from "@/lib/providers/tempolor";
import { getMusicGptConversionById } from "@/lib/providers/musicgpt";
import { uploadToS3 } from "@/lib/s3";
import { getPoYoStatusValue } from "@/lib/providers/poyo";
import { syncPoYoTaskResult } from "@/lib/poyo-sync";
import { getOriginalPoYoTaskId, requestMissingWavConversion } from "@/lib/request-wav-conversion";
import {
  contentTypeForFormat,
  detectFormatFromContentType,
  detectFormatFromUrl,
} from "@/lib/audio-format";
import { extractAudioDuration } from "@/lib/audio-duration";
import { generateAndSaveCoverArt } from "@/lib/generate-cover";
import axios from "axios";
import { requireAuth } from "@/lib/require-auth";
import { ensureWorkspaceSchema } from "@/lib/workspaces";

const GENERATION_TIMEOUT_MS = 15 * 60 * 1000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await ensureWorkspaceSchema();
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const result = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const track = result[0];

  if (track.status === "done" || track.status === "failed") {
    let audioUrl = track.audioUrl;
    let audioUrlHd = track.audioUrlHd;

    if (track.s3Key) {
      audioUrl = await getPresignedUrl(track.s3Key);
    }
    if (track.s3KeyHd) {
      audioUrlHd = await getPresignedUrl(track.s3KeyHd);
    }

    return NextResponse.json({
      ...track,
      audioUrl,
      audioUrlHd,
    });
  }

  if (track.provider === "poyo" && track.jobId) {
    try {
      const sourceJobId = getOriginalPoYoTaskId(track.jobId);
      const status = await getPoYoStatus(sourceJobId);
      const statusValue = getPoYoStatusValue(status);

      if (statusValue === "completed" || statusValue === "finished") {
        const syncResult = await syncPoYoTaskResult(sourceJobId, status);
        const syncedTrackIds = [...syncResult.updatedTrackIds, ...syncResult.createdTrackIds];
        if (syncedTrackIds.length > 0) {
          const syncedTracks = await db
            .select()
            .from(tracks)
            .where(inArray(tracks.id, syncedTrackIds));

          await Promise.allSettled(
            syncedTracks.map((syncedTrack) => requestMissingWavConversion(syncedTrack))
          );
        }

        const refreshed = await db
          .select()
          .from(tracks)
          .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

        if (refreshed.length > 0) {
          return NextResponse.json(refreshed[0]);
        }
      }

      if (statusValue === "failed" || statusValue === "error") {
        const updated = await db
          .update(tracks)
          .set({ status: "failed", error: status.error || status?.data?.error || "Generation failed" })
          .where(eq(tracks.id, track.id!))
          .returning();
        return NextResponse.json(updated[0]);
      }

      return NextResponse.json(track);
    } catch {
      return NextResponse.json(track);
    }
  }

  if (track.provider === "tempolor" && track.jobId) {
    try {
      const status = await getTempolorStatus(track.jobId);

      if (status.status === "completed") {
        const [mp3Res, hdRes] = await Promise.all([
          axios.get(status.audio_url, { responseType: "arraybuffer" }),
          status.audio_url_hd
            ? axios.get(status.audio_url_hd, { responseType: "arraybuffer" })
            : null,
        ]);

        const primaryHeaderType = String(mp3Res.headers?.["content-type"] || "");
        const format = /\.wav(\?|$)/i.test(status.audio_url)
          ? detectFormatFromUrl(status.audio_url)
          : detectFormatFromContentType(primaryHeaderType || "audio/mpeg");
        const formatHd = status.audio_url_hd
          ? detectFormatFromUrl(status.audio_url_hd)
          : null;

        const s3Key = `tracks/${track.id}/audio.${format}`;
        const s3KeyHd = status.audio_url_hd && formatHd
          ? `tracks/${track.id}/audio_hd.${formatHd}`
          : null;

        await uploadToS3(s3Key, Buffer.from(mp3Res.data), contentTypeForFormat(format));
        if (hdRes && s3KeyHd) {
          await uploadToS3(s3KeyHd, Buffer.from(hdRes.data), contentTypeForFormat(formatHd!));
        }

        const updated = await db
          .update(tracks)
          .set({
            status: "done",
            s3Key,
            s3KeyHd,
            format,
            formatHd,
            audioUrl: `/api/tracks/${track.id}/download`,
            audioUrlHd: s3KeyHd ? `/api/tracks/${track.id}/download?hd=true` : null,
          })
          .where(eq(tracks.id, track.id!))
          .returning();

        return NextResponse.json(updated[0]);
      }

      if (status.status === "failed") {
        const updated = await db
          .update(tracks)
          .set({ status: "failed", error: status.error || "Generation failed" })
          .where(eq(tracks.id, track.id!))
          .returning();
        return NextResponse.json(updated[0]);
      }

      return NextResponse.json(track);
    } catch {
      return NextResponse.json(track);
    }
  }

  if (track.provider === "musicgpt" && track.conversionId) {
    try {
      const conversion = await getMusicGptConversionById(track.conversionId);

      if (conversion) {
        const status = (conversion.status ?? "").toUpperCase();
        const audioUrl =
          conversion.audio_url ??
          conversion.conversion_path_1 ??
          conversion.conversion_path ??
          null;

        if (status === "COMPLETED" && audioUrl) {
          const audioRes = await axios.get(audioUrl, {
            responseType: "arraybuffer",
            timeout: 60000,
          });

          const audioBuffer = Buffer.from(audioRes.data);
          const s3Key = `tracks/${track.id}/audio.mp3`;
          await uploadToS3(s3Key, audioBuffer, "audio/mpeg");

          const duration = await extractAudioDuration(audioBuffer);

          const updated = await db
            .update(tracks)
            .set({
              status: "done",
              s3Key,
              format: "mp3",
              duration,
              audioUrl: `/api/tracks/${track.id}/download`,
              error: null,
            })
            .where(eq(tracks.id, track.id!))
            .returning();

          if (!track.s3KeyCover) {
            generateAndSaveCoverArt({
              id: track.id,
              userId: track.userId,
              title: track.title,
              prompt: track.prompt,
              instrumental: track.instrumental,
            }).catch(() => {});
          }

          return NextResponse.json(updated[0]);
        }

        if (status === "FAILED" || status.includes("FAIL")) {
          const updated = await db
            .update(tracks)
            .set({
              status: "failed",
              error: conversion.status_msg || "Generation failed",
            })
            .where(eq(tracks.id, track.id!))
            .returning();
          return NextResponse.json(updated[0]);
        }
      }

      return NextResponse.json(track);
    } catch {
      return NextResponse.json(track);
    }
  }

  if (track.createdAt && track.provider !== "musicgpt") {
    const elapsed = Date.now() - new Date(track.createdAt).getTime();
    if (elapsed > GENERATION_TIMEOUT_MS) {
      const updated = await db
        .update(tracks)
        .set({ status: "failed", error: "Generation timed out. Please try again." })
        .where(eq(tracks.id, track.id!))
        .returning();
      return NextResponse.json(updated[0]);
    }
  }

  return NextResponse.json(track);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await ensureWorkspaceSchema();
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const result = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { title, regenerateCoverArt, workspaceId } = body;

    if (title === undefined && regenerateCoverArt !== true && workspaceId === undefined) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
    }

    if (regenerateCoverArt === true) {
      const track = result[0];
      await generateAndSaveCoverArt(
        {
          id: track.id,
          userId: track.userId,
          title: track.title,
          prompt: track.prompt,
          instrumental: track.instrumental,
        },
        { forceNew: true }
      );

      const refreshed = await db
        .select()
        .from(tracks)
        .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

      return NextResponse.json(refreshed[0]);
    }

    const updates: Partial<typeof tracks.$inferInsert> = {};

    if (title !== undefined) {
      updates.title = title;
    }

    if (workspaceId !== undefined) {
      if (workspaceId === null) {
        updates.workspaceId = null;
      } else if (typeof workspaceId === "string" && workspaceId.trim()) {
        const targetWorkspace = await db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(and(eq(workspaces.id, workspaceId.trim()), eq(workspaces.userId, userId)))
          .limit(1);

        if (!targetWorkspace[0]) {
          return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
        }

        updates.workspaceId = targetWorkspace[0].id;
      } else {
        return NextResponse.json({ error: "Invalid workspaceId" }, { status: 400 });
      }
    }

    const updated = await db
      .update(tracks)
      .set(updates)
      .where(and(eq(tracks.id, id), eq(tracks.userId, userId)))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update track" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await ensureWorkspaceSchema();
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const result = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const track = result[0];

  try {
    if (track.s3Key) {
      await deleteFromS3(track.s3Key);
    }
    if (track.s3KeyHd) {
      await deleteFromS3(track.s3KeyHd);
    }
    if (track.s3KeyCover) {
      await deleteFromS3(track.s3KeyCover);
    }

    await db
      .delete(tracks)
      .where(eq(tracks.id, id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete track" }, { status: 500 });
  }
}
