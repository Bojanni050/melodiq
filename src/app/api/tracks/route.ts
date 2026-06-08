import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, desc, and, inArray, ne, lt } from "drizzle-orm";
import { createHash } from "node:crypto";
import { requireAuth } from "@/lib/require-auth";
import { getPoYoStatus, getPoYoStatusValue } from "@/lib/providers/poyo";
import { syncPoYoTaskResult } from "@/lib/poyo-sync";
import { getOriginalPoYoTaskId, requestMissingWavConversion } from "@/lib/request-wav-conversion";
import { uploadToS3 } from "@/lib/s3";
import { contentTypeForFormat, detectFormatFromUrl, detectFormatFromContentType } from "@/lib/audio-format";
import { convertWavToFlac, saveWavLocally } from "@/lib/wav-to-flac";
import { extractAudioDuration } from "@/lib/audio-duration";
import { workspaces } from "@/db/schema";
import {
  ensureDefaultWorkspaceForUser,
  ensureWorkspaceSchema,
  getUserWorkspacesWithTrackIds,
} from "@/lib/workspaces";
import { generateAndSaveCoverArtForBatch } from "@/lib/generate-cover";

export const dynamic = "force-dynamic";

const GENERATION_TIMEOUT_MS = 15 * 60 * 1000;

const MAX_FILES_PER_UPLOAD = 20;
const MAX_TRACKS_PER_COVER_REGEN = 50;

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function detectUploadFormat(file: File): "mp3" | "wav" | null {
  const type = file.type.toLowerCase();
  const filename = file.name.toLowerCase();

  if (
    type.includes("mpeg") ||
    type.includes("mp3") ||
    filename.endsWith(".mp3")
  ) {
    return "mp3";
  }

  if (
    type.includes("wav") ||
    type.includes("wave") ||
    filename.endsWith(".wav")
  ) {
    return "wav";
  }

  return null;
}

function titleFromFilename(filename: string) {
  const withoutExtension = filename.replace(/\.[^/.]+$/, "").trim();
  return withoutExtension || "Untitled Upload";
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  await ensureWorkspaceSchema();

  const statusFilter = new URL(request.url).searchParams.get("status");
  const baseWhere = statusFilter
    ? and(eq(tracks.userId, userId), eq(tracks.status, statusFilter))
    : eq(tracks.userId, userId);

  const result = await db
    .select()
    .from(tracks)
    .where(baseWhere)
    .orderBy(desc(tracks.createdAt));

  // PoYo polling and timeout updates only make sense when fetching all statuses.
  // Skip both when a status filter is active (e.g. ?status=done from the library page).
  let hadGeneratingPoYo = false;
  if (!statusFilter) {
    const generatingPoYoTracks = Array.from(
      new Map(
        result
          .filter((track) => track.provider === "poyo" && track.status === "generating" && !!track.jobId)
          .map((track) => [getOriginalPoYoTaskId(track.jobId!), track])
      ).values()
    ).slice(0, 5);

    const timeoutCutoff = new Date(Date.now() - GENERATION_TIMEOUT_MS);

    hadGeneratingPoYo = generatingPoYoTracks.length > 0;
    await Promise.allSettled([
      hadGeneratingPoYo
        ? Promise.allSettled(
            generatingPoYoTracks.map(async (track) => {
              try {
                const sourceJobId = getOriginalPoYoTaskId(track.jobId!);
                const statusPayload = await getPoYoStatus(sourceJobId);
                const statusValue = getPoYoStatusValue(statusPayload);
                if (statusValue === "completed" || statusValue === "finished") {
                  const syncResult = await syncPoYoTaskResult(sourceJobId, statusPayload);
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
                }
              } catch {
                // Best-effort fallback polling for missed webhooks.
              }
            })
          )
        : Promise.resolve(),

      db.update(tracks)
        .set({ status: "failed", error: "Generation timed out. Please try again." })
        .where(
          and(
            eq(tracks.userId, userId),
            inArray(tracks.status, ["pending", "generating"]),
            ne(tracks.provider, "musicgpt"),
            lt(tracks.createdAt, timeoutCutoff)
          )
        ),
    ]);
  }

  // Re-fetch only when PoYo syncing may have mutated rows; otherwise reuse the initial query result.
  const finalTracks = hadGeneratingPoYo
    ? await db.select().from(tracks).where(eq(tracks.userId, userId)).orderBy(desc(tracks.createdAt))
    : result;

  const workspacePayload = await getUserWorkspacesWithTrackIds(
    userId,
    finalTracks.map((track) => ({ id: track.id, workspaceId: track.workspaceId ?? null }))
  );

  return NextResponse.json(
    { tracks: finalTracks, workspaces: workspacePayload },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body: unknown = await request.json();
  if (!isJsonObject(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const regenerateCoverArt = body.regenerateCoverArt;
  const trackIds = body.trackIds;

  if (regenerateCoverArt !== true || !Array.isArray(trackIds)) {
    return NextResponse.json({ error: "Unsupported operation" }, { status: 400 });
  }

  const normalizedIds = Array.from(
    new Set(
      trackIds
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );

  if (normalizedIds.length === 0) {
    return NextResponse.json({ error: "No trackIds provided" }, { status: 400 });
  }

  if (normalizedIds.length > MAX_TRACKS_PER_COVER_REGEN) {
    return NextResponse.json(
      { error: `Too many tracks selected (max ${MAX_TRACKS_PER_COVER_REGEN})` },
      { status: 400 }
    );
  }

  const rows = await db
    .select({
      id: tracks.id,
      userId: tracks.userId,
      title: tracks.title,
      prompt: tracks.prompt,
      instrumental: tracks.instrumental,
    })
    .from(tracks)
    .where(and(eq(tracks.userId, userId), inArray(tracks.id, normalizedIds)));

  if (rows.length === 0) {
    return NextResponse.json({ error: "Tracks not found" }, { status: 404 });
  }

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const ordered = normalizedIds
    .map((id) => rowById.get(id))
    .filter((row): row is (typeof rows)[number] => Boolean(row));

  await generateAndSaveCoverArtForBatch(
    {
      tracks: ordered.map((t) => ({
        id: t.id,
        userId: t.userId,
        prompt: t.prompt,
        title: t.title ?? null,
        instrumental: t.instrumental,
      })),
    },
    { forceNew: true }
  );

  return NextResponse.json({ success: true, trackIds: ordered.map((t) => t.id) });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  await ensureWorkspaceSchema();

  try {
    const formData = await request.formData();
    const uploadedEntries = formData.getAll("files");
    const files = uploadedEntries.filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    if (files.length > MAX_FILES_PER_UPLOAD) {
      return NextResponse.json(
        { error: `You can upload up to ${MAX_FILES_PER_UPLOAD} files at once.` },
        { status: 400 }
      );
    }

    const requestedWorkspaceIdRaw = formData.get("workspaceId");
    const requestedWorkspaceId =
      typeof requestedWorkspaceIdRaw === "string" && requestedWorkspaceIdRaw.trim()
        ? requestedWorkspaceIdRaw.trim()
        : null;

    const defaultWorkspace = await ensureDefaultWorkspaceForUser(userId);
    let targetWorkspaceId = defaultWorkspace.id;

    if (requestedWorkspaceId) {
      const workspaceResult = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(and(eq(workspaces.id, requestedWorkspaceId), eq(workspaces.userId, userId)))
        .limit(1);

      if (workspaceResult[0]) {
        targetWorkspaceId = workspaceResult[0].id;
      }
    }

    const uploadedTracks: Array<typeof tracks.$inferSelect> = [];
    const rejected: Array<{ filename: string; reason: string }> = [];

    for (const file of files) {
      const format = detectUploadFormat(file);
      if (!format) {
        rejected.push({ filename: file.name, reason: "Only MP3 and WAV files are supported." });
        continue;
      }

      if (file.size === 0) {
        rejected.push({ filename: file.name, reason: "File is empty." });
        continue;
      }

      try {
        const trackId = crypto.randomUUID();
        const audioBuffer = Buffer.from(await file.arrayBuffer());
        const uploadHash = createHash("sha256").update(audioBuffer).digest("hex");

        const duplicateTrack = await db
          .select({ id: tracks.id })
          .from(tracks)
          .where(
            and(
              eq(tracks.userId, userId),
              eq(tracks.provider, "upload"),
              eq(tracks.audioId, uploadHash)
            )
          )
          .limit(1);

        if (duplicateTrack.length > 0) {
          rejected.push({ filename: file.name, reason: "Duplicate upload detected." });
          continue;
        }

        let uploadBuffer: Buffer = audioBuffer;
        let uploadFormat: "mp3" | "wav" | "flac" = format;

        if (format === "wav") {
          await saveWavLocally(trackId, audioBuffer);
          uploadBuffer = await convertWavToFlac(audioBuffer);
          uploadFormat = "flac";
        }

        const s3Key = `tracks/${trackId}/audio.${uploadFormat}`;
        const duration = await extractAudioDuration(audioBuffer);

        await uploadToS3(s3Key, uploadBuffer, contentTypeForFormat(uploadFormat));

        const inserted = await db
          .insert(tracks)
          .values({
            id: trackId,
            userId,
            title: titleFromFilename(file.name),
            provider: "upload",
            providerModel: "manual-upload",
            prompt: `Uploaded file: ${file.name}`,
            status: "done",
            s3Key,
            format: uploadFormat,
            duration,
            audioId: uploadHash,
            workspaceId: targetWorkspaceId,
            audioUrl: `/api/tracks/${trackId}/download`,
            instrumental: false,
            creditsUsed: 0,
            error: null,
          })
          .returning();

        if (inserted[0]) {
          uploadedTracks.push(inserted[0]);
        }
      } catch (error) {
        console.error("[tracks/upload] Failed to upload file:", file.name, error);
        rejected.push({ filename: file.name, reason: "Upload failed." });
      }
    }

    if (uploadedTracks.length === 0) {
      return NextResponse.json(
        {
          error: "No files were uploaded.",
          rejected,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      tracks: uploadedTracks,
      rejected,
    });
  } catch (error) {
    console.error("[tracks/upload] Unexpected upload error:", error);
    return NextResponse.json({ error: "Failed to upload files" }, { status: 500 });
  }
}
