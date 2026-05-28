import { db } from "@/db";
import { tracks } from "@/db/schema";
import { and, asc, eq, like, or } from "drizzle-orm";
import axios from "axios";
import { uploadToS3 } from "@/lib/s3";
import { extractPoYoVariants } from "@/lib/providers/poyo";
import {
  contentTypeForFormat,
  detectFormatFromContentType,
  detectFormatFromUrl,
} from "@/lib/audio-format";
import { extractAudioDuration } from "@/lib/audio-duration";

interface SyncPoYoTaskResult {
  found: boolean;
  variantCount: number;
  updatedTrackIds: string[];
  createdTrackIds: string[];
  variantIndexToTrackId: (string | null)[];
  userId?: string;
  error?: string;
}

function buildVariantTitle(baseTitle: string | null, index: number, variantTitle?: string): string {
  if (variantTitle && variantTitle.trim()) return variantTitle.trim();
  const title = (baseTitle || "Generated Track").trim();
  if (index === 0) return title;
  return `${title} (Version ${index + 1})`;
}

export async function syncPoYoTaskResult(taskId: string, payload: unknown): Promise<SyncPoYoTaskResult> {
  const existingTracks = await db
    .select()
    .from(tracks)
    .where(
      and(
        eq(tracks.provider, "poyo"),
        or(eq(tracks.jobId, taskId), like(tracks.jobId, `${taskId}:v%`))
      )
    )
    .orderBy(asc(tracks.createdAt));

  if (existingTracks.length === 0) {
    return {
      found: false,
      variantCount: 0,
      updatedTrackIds: [],
      createdTrackIds: [],
      variantIndexToTrackId: [],
      error: "Track not found",
    };
  }

  const baseTrack = existingTracks.find((t) => t.jobId === taskId) || existingTracks[0];
  const variants = extractPoYoVariants(payload);

  if (variants.length === 0) {
    return {
      found: true,
      variantCount: 0,
      updatedTrackIds: [],
      createdTrackIds: [],
      variantIndexToTrackId: [],
      userId: baseTrack.userId,
      error: "No audio variants in PoYo payload",
    };
  }

  const updatedTrackIds: string[] = [];
  const createdTrackIds: string[] = [];

  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];
    const variantJobId = i === 0 ? taskId : `${taskId}:v${i + 1}`;

    let targetTrack = existingTracks.find((t) => t.jobId === variantJobId);

    if (!targetTrack) {
      const inserted = await db
        .insert(tracks)
        .values({
          userId: baseTrack.userId,
          title: buildVariantTitle(baseTrack.title, i, variant.title),
          provider: baseTrack.provider,
          providerModel: baseTrack.providerModel,
          prompt: baseTrack.prompt,
          lyrics: baseTrack.lyrics,
          language: baseTrack.language,
          instrumental: baseTrack.instrumental,
          status: "generating",
          jobId: variantJobId,
          creditsUsed: baseTrack.creditsUsed,
        })
        .returning();

      targetTrack = inserted[0];
      existingTracks.push(targetTrack);
      createdTrackIds.push(targetTrack.id);
    }

    const primaryUrl = variant.audioUrl || variant.audioUrlHd;
    if (!primaryUrl) {
      continue;
    }

    const audioRes = await axios.get(primaryUrl, { responseType: "arraybuffer" });
    const audioBuffer = Buffer.from(audioRes.data);
    const primaryHeaderType = String(audioRes.headers?.["content-type"] || "");
    const format = /\.wav(\?|$)/i.test(primaryUrl)
      ? detectFormatFromUrl(primaryUrl)
      : detectFormatFromContentType(primaryHeaderType || "audio/mpeg");
    const s3Key = targetTrack.s3Key ?? `tracks/${targetTrack.id}/audio.${format}`;
    await uploadToS3(s3Key, audioBuffer, contentTypeForFormat(format));

    // Extract duration from audio file
    const duration = await extractAudioDuration(audioBuffer);

    let s3KeyHd: string | null = null;
    let formatHd: "mp3" | "wav" | null = null;
    if (variant.audioUrlHd && variant.audioUrlHd !== primaryUrl) {
      const hdRes = await axios.get(variant.audioUrlHd, { responseType: "arraybuffer" });
      const hdHeaderType = String(hdRes.headers?.["content-type"] || "");
      formatHd = /\.wav(\?|$)/i.test(variant.audioUrlHd)
        ? detectFormatFromUrl(variant.audioUrlHd)
        : detectFormatFromContentType(hdHeaderType || "audio/mpeg");
      s3KeyHd = targetTrack.s3KeyHd ?? `tracks/${targetTrack.id}/audio_hd.${formatHd}`;
      await uploadToS3(s3KeyHd, Buffer.from(hdRes.data), contentTypeForFormat(formatHd));
    }

    await db
      .update(tracks)
      .set({
        status: "done",
        title: buildVariantTitle(baseTrack.title, i, variant.title),
        audioId: variant.audioId ?? targetTrack.audioId,
        s3Key,
        s3KeyHd,
        format,
        formatHd,
        duration,
        audioUrl: `/api/tracks/${targetTrack.id}/download`,
        audioUrlHd: s3KeyHd ? `/api/tracks/${targetTrack.id}/download?hd=true` : null,
        error: null,
      })
      .where(eq(tracks.id, targetTrack.id));

    updatedTrackIds.push(targetTrack.id);
  }

  return {
    found: true,
    variantCount: variants.length,
    updatedTrackIds,
    createdTrackIds,
    variantIndexToTrackId: variants.map((_, i) => {
      const variantJobId = i === 0 ? taskId : `${taskId}:v${i + 1}`;
      return existingTracks.find((t) => t.jobId === variantJobId)?.id ?? null;
    }),
    userId: baseTrack.userId,
  };
}
