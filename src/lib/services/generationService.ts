import { NextResponse } from "next/server";
import { db } from "@/db";
import { tracks, clonedVoices } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateLyria } from "@/lib/providers/lyria";
import { generatePoYo, generateMinimaxMusic26 } from "@/lib/providers/poyo";
import { generateTempolor } from "@/lib/providers/tempolor";
import { generateMusicGpt } from "@/lib/providers/musicgpt";
import { generateMinimax } from "@/lib/providers/minimax";
import { generateMureka } from "@/lib/providers/mureka";
import { generateHeartMula } from "@/lib/providers/heartmula";
import { generateApiframe } from "@/lib/providers/apiframe";
import { createApimartGeneration } from "@/lib/providers/apimart";
import { uploadToS3 } from "@/lib/s3";
import { logApi } from "@/lib/logger";
import { getSetting, getWebhookUrl } from "@/lib/settings";
import { type AudioFormat, contentTypeForFormat, detectFormatFromContentType } from "@/lib/audio-format";
import { extractAudioDuration } from "@/lib/audio-duration";
import { computeAudioDna } from "@/lib/audio-dna";
import {
  insertPendingTrack,
  reserveTrackS3Keys,
  markTrackGenerating,
  markTrackDone,
  markTrackFailed,
  markTracksFailedBatch,
  spawnCoverArtAsync,
  spawnCoverArtBatchAsync,
  spawnLanguageDetectionAsync,
} from "@/lib/services/trackService";

export type GenerationContext = {
  userId: string;
  startTime: number;
  provider: string;
  providerModel: string;
  prompt: string;
  lyrics?: string;
  instrumental: boolean;
  resolvedTitle: string | null;
  resolvedArtistName: string | null;
  resolvedWriterName: string | null;
  vocalGender?: string;
  weirdness?: number;
  styleInfluence?: number;
  audioWeight?: number;
  negativeTags?: string;
  personaId?: string;
  normalizedPoYoModel: string;
  isMinimaxViaPoYo: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function copyrightError(error: any) {
  const isCopyright = error.message === "COPYRIGHT";
  const errorMessage = isCopyright
    ? "Copyright detected -> click Optimize in Studio to rewrite safely"
    : error.message || "Generation failed";
  return { isCopyright, errorMessage };
}

// ---------------------------------------------------------------------------
// PoYo (Minimax 2.6 via PoYo) — single async track
// ---------------------------------------------------------------------------

export async function dispatchMinimaxViaPoYo(ctx: GenerationContext): Promise<NextResponse> {
  const { userId, startTime, provider, providerModel, prompt, lyrics, instrumental, resolvedTitle, resolvedArtistName, resolvedWriterName } = ctx;

  const track = await insertPendingTrack({ userId, provider, providerModel, prompt, lyrics: lyrics || null, instrumental, title: resolvedTitle, artistName: resolvedArtistName, writerName: resolvedWriterName });
  const reserved = await reserveTrackS3Keys(track.id!);

  try {
    const genResult = await generateMinimaxMusic26({ prompt, lyrics, instrumental });
    const [baseJobId] = genResult.jobIds;
    if (!baseJobId) throw { message: "Minimax via PoYo returned no task ID", statusCode: 500 };

    const updated = await markTrackGenerating(reserved.id!, baseJobId);
    spawnCoverArtBatchAsync([{ id: updated.id!, userId: updated.userId, prompt: updated.prompt, instrumental: updated.instrumental }], resolvedTitle, "minimax via poyo");

    await logApi({ userId, type: "generation", provider: "poyo", endpoint: "/api/generate", request: JSON.stringify({ provider, providerModel: "minimax-music-2.6", prompt }), response: JSON.stringify({ status: "generating", jobIds: genResult.jobIds }), statusCode: 200, duration: Date.now() - startTime });
    return NextResponse.json({ tracks: [updated] });
  } catch (error: any) {
    const { isCopyright, errorMessage } = copyrightError(error);
    await markTrackFailed(reserved.id!, errorMessage);
    await logApi({ userId, type: "generation", provider: "poyo", endpoint: "/api/generate", request: JSON.stringify({ provider, providerModel: "minimax-music-2.6", prompt }), response: JSON.stringify({ error: error.message }), statusCode: error.statusCode || 500, duration: Date.now() - startTime });
    return NextResponse.json({ error: errorMessage }, { status: isCopyright ? 400 : 500 });
  }
}

// ---------------------------------------------------------------------------
// PoYo — dual async tracks
// ---------------------------------------------------------------------------

export async function dispatchPoYo(ctx: GenerationContext): Promise<NextResponse> {
  const { userId, startTime, provider, providerModel, prompt, lyrics, instrumental, resolvedTitle, resolvedArtistName, resolvedWriterName, normalizedPoYoModel, vocalGender, weirdness, styleInfluence } = ctx;

  const [track1, track2] = await Promise.all([
    insertPendingTrack({ userId, provider, providerModel, prompt, lyrics: lyrics || null, instrumental, title: resolvedTitle, artistName: resolvedArtistName, writerName: resolvedWriterName }),
    insertPendingTrack({ userId, provider, providerModel, prompt, lyrics: lyrics || null, instrumental, title: resolvedTitle ? `${resolvedTitle} (2)` : null, artistName: resolvedArtistName, writerName: resolvedWriterName }),
  ]);

  const [reserved1, reserved2] = await Promise.all([
    reserveTrackS3Keys(track1.id!),
    reserveTrackS3Keys(track2.id!),
  ]);

  try {
    const genResult = await generatePoYo({ prompt, lyrics, instrumental, model: normalizedPoYoModel, title: resolvedTitle || undefined, gender: vocalGender && vocalGender !== "auto" ? vocalGender : undefined, weirdness: typeof weirdness === "number" ? Math.round(weirdness) / 100 : undefined, styleInfluence: typeof styleInfluence === "number" ? Math.round(styleInfluence) / 100 : undefined });
    const [baseJobId] = genResult.jobIds;
    if (!baseJobId) throw { message: "PoYo returned no task ID", statusCode: 500 };
    const secondJobId = genResult.jobIds[1] ?? `${baseJobId}:v2`;

    const [u1, u2] = await Promise.all([
      markTrackGenerating(reserved1.id!, baseJobId),
      markTrackGenerating(reserved2.id!, secondJobId),
    ]);

    spawnCoverArtBatchAsync([u1, u2].map((t) => ({ id: t.id!, userId: t.userId, prompt: t.prompt, instrumental: t.instrumental })), resolvedTitle, "poyo");

    await logApi({ userId, type: "generation", provider: "poyo", endpoint: "/api/generate", request: JSON.stringify({ provider, providerModel, prompt }), response: JSON.stringify({ status: "generating", jobIds: genResult.jobIds }), statusCode: 200, duration: Date.now() - startTime });
    return NextResponse.json({ tracks: [u1, u2] });
  } catch (error: any) {
    const { isCopyright, errorMessage } = copyrightError(error);
    await markTracksFailedBatch([reserved1.id!, reserved2.id!], errorMessage);
    await logApi({ userId, type: "generation", provider, endpoint: "/api/generate", request: JSON.stringify({ provider, providerModel, prompt }), response: JSON.stringify({ error: error.message }), statusCode: error.statusCode || 500, duration: Date.now() - startTime });
    return NextResponse.json({ error: errorMessage }, { status: isCopyright ? 400 : 500 });
  }
}

// ---------------------------------------------------------------------------
// Lyria — synchronous, single track
// ---------------------------------------------------------------------------

export async function dispatchLyria(ctx: GenerationContext, track: any): Promise<NextResponse> {
  const { userId, startTime, provider, providerModel, prompt, lyrics, instrumental, resolvedTitle } = ctx;

  try {
    const genResult = await generateLyria({ prompt, lyrics, instrumental, model: providerModel, returnBothFormats: true });

    const format = detectFormatFromContentType(genResult.mimeType || "audio/mpeg");
    const s3Key = `tracks/${track.id}/audio.${format}`;
    let s3KeyHd: string | null = null;
    let formatHd: AudioFormat | null = null;
    let audioUrlHd: string | null = null;

    if (genResult.audioBufferHd && genResult.mimeTypeHd) {
      formatHd = detectFormatFromContentType(genResult.mimeTypeHd);
      s3KeyHd = `tracks/${track.id}/audio_hd.${formatHd}`;
      audioUrlHd = `/api/tracks/${track.id}/download?hd=true`;
    }

    await Promise.all([
      uploadToS3(s3Key, genResult.audioBuffer, contentTypeForFormat(format)),
      ...(s3KeyHd && formatHd && genResult.audioBufferHd ? [uploadToS3(s3KeyHd, genResult.audioBufferHd, contentTypeForFormat(formatHd))] : []),
    ]);

    const [audioDuration, audioDna] = await Promise.all([
      extractAudioDuration(genResult.audioBuffer),
      computeAudioDna({ audioBuffer: genResult.audioBuffer, prompt, lyrics: lyrics || null, instrumental }),
    ]);

    const updated = await markTrackDone(track.id!, { s3Key, format, audioUrl: `/api/tracks/${track.id}/download`, s3KeyHd, formatHd, audioUrlHd, duration: audioDuration, audioDna });

    spawnCoverArtAsync({ id: track.id!, userId: track.userId, title: resolvedTitle, prompt, instrumental }, "lyria");
    spawnLanguageDetectionAsync(track, lyrics, instrumental, "lyria");

    await logApi({ userId, type: "generation", provider: "lyria", endpoint: "/api/generate", request: JSON.stringify({ provider, providerModel, prompt }), response: JSON.stringify({ status: "done", trackId: updated.id }), statusCode: 200, duration: Date.now() - startTime });
    return NextResponse.json({ track: updated });
  } catch (error: any) {
    throw error; // bubble up to route.ts catch handler
  }
}

// ---------------------------------------------------------------------------
// Minimax — synchronous direct or async via PoYo
// ---------------------------------------------------------------------------

export async function dispatchMinimax(ctx: GenerationContext, track: any): Promise<NextResponse> {
  const { userId, startTime, provider, providerModel, prompt, lyrics, instrumental, resolvedTitle } = ctx;

  const usePoYo = await getSetting("MINIMAX_USE_POYO");

  if (usePoYo === "true") {
    const reserved = await reserveTrackS3Keys(track.id!);

    try {
      const genResult = await generateMinimaxMusic26({ prompt, lyrics, instrumental });
      const [baseJobId] = genResult.jobIds;
      if (!baseJobId) throw { message: "Minimax via PoYo returned no task ID", statusCode: 500 };

      const updated = await markTrackGenerating(reserved.id!, baseJobId, { provider: "poyo", providerModel: "minimax-music-2.6" });
      spawnCoverArtBatchAsync([{ id: updated.id!, userId: updated.userId, prompt: updated.prompt, instrumental: updated.instrumental }], resolvedTitle, "minimax via poyo");

      await logApi({ userId, type: "generation", provider: "minimax", endpoint: "/api/generate", request: JSON.stringify({ provider, providerModel, prompt }), response: JSON.stringify({ status: "generating", jobIds: genResult.jobIds }), statusCode: 200, duration: Date.now() - startTime });
      return NextResponse.json({ tracks: [updated] });
    } catch (error: any) {
      const { isCopyright, errorMessage } = copyrightError(error);
      await markTrackFailed(reserved.id!, errorMessage);
      await logApi({ userId, type: "generation", provider: "minimax", endpoint: "/api/generate", request: JSON.stringify({ provider, providerModel, prompt }), response: JSON.stringify({ error: error.message }), statusCode: error.statusCode || 500, duration: Date.now() - startTime });
      return NextResponse.json({ error: errorMessage }, { status: isCopyright ? 400 : 500 });
    }
  }

  // Direct Minimax API — synchronous
  const genResult = await generateMinimax({ prompt, lyrics, instrumental });
  const format = detectFormatFromContentType(genResult.mimeType || "audio/mpeg");
  const s3Key = `tracks/${track.id}/audio.${format}`;
  await uploadToS3(s3Key, genResult.audioBuffer, contentTypeForFormat(format));

  const [audioDuration, audioDna] = await Promise.all([
    extractAudioDuration(genResult.audioBuffer),
    computeAudioDna({ audioBuffer: genResult.audioBuffer, prompt, lyrics: lyrics || null, instrumental }),
  ]);

  const updated = await markTrackDone(track.id!, { s3Key, format, audioUrl: `/api/tracks/${track.id}/download`, duration: audioDuration, audioDna });
  spawnCoverArtAsync({ id: track.id!, userId: track.userId, title: resolvedTitle, prompt, instrumental }, "minimax");
  spawnLanguageDetectionAsync(track, lyrics, instrumental, "minimax");

  await logApi({ userId, type: "generation", provider: "minimax", endpoint: "/api/generate", request: JSON.stringify({ provider, providerModel, prompt }), response: JSON.stringify({ status: "done", trackId: updated.id }), statusCode: 200, duration: Date.now() - startTime });
  return NextResponse.json({ track: updated });
}

// ---------------------------------------------------------------------------
// Tempolor — async, multi-track
// ---------------------------------------------------------------------------

export async function dispatchTempolor(ctx: GenerationContext, track: any): Promise<NextResponse> {
  const { userId, startTime, provider, providerModel, prompt, lyrics, instrumental, resolvedTitle, resolvedArtistName, resolvedWriterName } = ctx;

  const genResult = await generateTempolor({ prompt, lyrics, instrumental, model: providerModel });
  const jobIds: string[] = genResult.jobIds;

  const firstUpdated = await markTrackGenerating(track.id!, jobIds[0]);

  const extraInserted = await Promise.all(
    jobIds.slice(1).map((jobId) =>
      db.insert(tracks).values({ userId, provider, providerModel, prompt, lyrics: lyrics || null, instrumental, title: resolvedTitle, artistName: resolvedArtistName, writerName: resolvedWriterName, status: "generating", jobId }).returning().then((r) => r[0])
    )
  );

  const allTracks = [firstUpdated, ...extraInserted];
  spawnCoverArtBatchAsync(allTracks.map((t) => ({ id: t.id!, userId: t.userId, prompt: t.prompt, instrumental: t.instrumental })), resolvedTitle, "tempolor");

  await logApi({ userId, type: "generation", provider: "tempolor", endpoint: "/api/generate", request: JSON.stringify({ provider, providerModel, prompt }), response: JSON.stringify({ status: "generating", jobIds }), statusCode: 200, duration: Date.now() - startTime });
  return NextResponse.json({ tracks: allTracks });
}

// ---------------------------------------------------------------------------
// MusicGPT — async, dual track
// ---------------------------------------------------------------------------

export async function dispatchMusicGpt(ctx: GenerationContext, track: any): Promise<NextResponse> {
  const { userId, startTime, provider, providerModel, prompt, lyrics, instrumental, resolvedTitle, resolvedArtistName, resolvedWriterName, vocalGender } = ctx;

  const webhookUrl = await getWebhookUrl("musicgpt");
  const genResult = await generateMusicGpt({ prompt, lyrics, instrumental, gender: vocalGender && vocalGender !== "auto" ? vocalGender : "", webhookUrl });

  const updated = await db.update(tracks).set({ status: "generating", jobId: genResult.taskId, conversionId: genResult.conversionId1 }).where(eq(tracks.id, track.id!)).returning();
  const track2 = await db.insert(tracks).values({ userId, provider: "musicgpt", providerModel, prompt, lyrics: lyrics || null, instrumental, title: resolvedTitle, artistName: resolvedArtistName, writerName: resolvedWriterName, status: "generating", jobId: genResult.taskId, conversionId: genResult.conversionId2 }).returning();

  const allTracks = [updated[0], track2[0]];
  spawnCoverArtBatchAsync(allTracks.map((t) => ({ id: t.id!, userId: t.userId, prompt: t.prompt, instrumental: t.instrumental })), resolvedTitle, "musicgpt");

  await logApi({ userId, type: "generation", provider: "musicgpt", endpoint: "/api/generate", request: JSON.stringify({ provider, providerModel, prompt }), response: JSON.stringify({ status: "generating", taskId: genResult.taskId, conversions: [genResult.conversionId1, genResult.conversionId2] }), statusCode: 200, duration: Date.now() - startTime });
  return NextResponse.json({ tracks: allTracks });
}

// ---------------------------------------------------------------------------
// Mureka — async, dual track
// ---------------------------------------------------------------------------

export async function dispatchMureka(ctx: GenerationContext, track: any): Promise<NextResponse> {
  const { userId, startTime, provider, providerModel, prompt, lyrics, instrumental, resolvedTitle, resolvedArtistName, resolvedWriterName } = ctx;

  const murekaWebhookUrl = await getWebhookUrl("mureka");
  const genResult = await generateMureka({ lyrics: instrumental ? undefined : lyrics, prompt: prompt || undefined, numberOfSongs: 2, outputFormat: "mp3", webhookUrl: murekaWebhookUrl || undefined, instrumental: instrumental || false });

  const [t1, t2] = await Promise.all([
    db.update(tracks).set({ status: "generating", jobId: genResult.requestId }).where(eq(tracks.id, track.id!)).returning(),
    db.insert(tracks).values({ userId, provider: "mureka", providerModel: "mureka-v9", prompt, lyrics: instrumental ? null : (lyrics || null), instrumental, title: resolvedTitle ? `${resolvedTitle} (2)` : null, artistName: resolvedArtistName, writerName: resolvedWriterName, status: "generating", jobId: `${genResult.requestId}:1` }).returning(),
  ]);

  const allTracks = [t1[0], t2[0]];
  spawnCoverArtBatchAsync(allTracks.map((t) => ({ id: t.id!, userId: t.userId, prompt: t.prompt, instrumental: t.instrumental })), resolvedTitle, "mureka");

  await logApi({ userId, type: "generation", provider: "mureka", endpoint: "/api/generate", request: JSON.stringify({ provider, prompt, lyrics: lyrics?.slice(0, 100) }), response: JSON.stringify({ status: "generating", requestId: genResult.requestId }), statusCode: 200, duration: Date.now() - startTime });
  return NextResponse.json({ tracks: allTracks });
}

// ---------------------------------------------------------------------------
// HeartMuLa — async, single track
// ---------------------------------------------------------------------------

export async function dispatchHeartMula(ctx: GenerationContext, track: any): Promise<NextResponse> {
  const { userId, startTime, provider, prompt, lyrics, instrumental, resolvedTitle } = ctx;

  const heartmulaWebhookUrl = await getWebhookUrl("heartmula");
  const genResult = await generateHeartMula({ lyrics: lyrics!, tags: prompt || undefined, webhookUrl: heartmulaWebhookUrl || undefined });

  const updated = await db.update(tracks).set({ status: "generating", jobId: genResult.requestId }).where(eq(tracks.id, track.id!)).returning();
  spawnCoverArtAsync({ id: track.id!, userId: track.userId, title: resolvedTitle, prompt, instrumental, lyrics: lyrics || undefined }, "heartmula");

  await logApi({ userId, type: "generation", provider: "heartmula", endpoint: "/api/generate", request: JSON.stringify({ provider, prompt, lyrics: lyrics?.slice(0, 100) }), response: JSON.stringify({ status: "generating", requestId: genResult.requestId }), statusCode: 200, duration: Date.now() - startTime });
  return NextResponse.json({ track: updated[0] });
}

// ---------------------------------------------------------------------------
// APIFrame — async, single or dual track depending on model
// ---------------------------------------------------------------------------

export async function dispatchApiframe(ctx: GenerationContext, track: any): Promise<NextResponse> {
  const { userId, startTime, provider, providerModel, prompt, lyrics, instrumental, resolvedTitle, resolvedArtistName, resolvedWriterName } = ctx;

  const genResult = await generateApiframe({ prompt, lyrics: instrumental ? undefined : (lyrics || undefined), instrumental, model: providerModel, title: resolvedTitle || undefined });
  const modelCode = providerModel?.toLowerCase() || "";
  const isMultiSong = modelCode.includes("suno") || modelCode.includes("udio");

  let allTracks: any[];
  if (isMultiSong) {
    const [t1, t2] = await Promise.all([
      db.update(tracks).set({ status: "generating", jobId: genResult.jobId }).where(eq(tracks.id, track.id!)).returning(),
      db.insert(tracks).values({ userId, provider: "apiframe", providerModel, prompt, lyrics: instrumental ? null : (lyrics || null), instrumental, title: resolvedTitle ? `${resolvedTitle} (2)` : null, artistName: resolvedArtistName, writerName: resolvedWriterName, status: "generating", jobId: `${genResult.jobId}:1` }).returning(),
    ]);
    allTracks = [t1[0], t2[0]];
  } else {
    const updated = await db.update(tracks).set({ status: "generating", jobId: genResult.jobId }).where(eq(tracks.id, track.id!)).returning();
    allTracks = [updated[0]];
  }

  spawnCoverArtBatchAsync(allTracks.map((t) => ({ id: t.id!, userId: t.userId, prompt: t.prompt, instrumental: t.instrumental })), resolvedTitle, "apiframe");

  await logApi({ userId, type: "generation", provider: "apiframe", endpoint: "/api/generate", request: JSON.stringify({ provider, providerModel, prompt }), response: JSON.stringify({ status: "generating", jobId: genResult.jobId }), statusCode: 200, duration: Date.now() - startTime });
  return NextResponse.json({ tracks: allTracks });
}

// ---------------------------------------------------------------------------
// APIMart — async, dual track with optional cloned voice
// ---------------------------------------------------------------------------

export async function dispatchApimart(ctx: GenerationContext, track: any): Promise<NextResponse> {
  const { userId, startTime, provider, providerModel, prompt, lyrics, instrumental, resolvedTitle, resolvedArtistName, resolvedWriterName, vocalGender, weirdness, styleInfluence, audioWeight, negativeTags, personaId } = ctx;

  let verifiedPersonaId: string | undefined;
  if (personaId) {
    const [ownedVoice] = await db.select({ id: clonedVoices.id }).from(clonedVoices).where(and(eq(clonedVoices.userId, userId), eq(clonedVoices.personaId, personaId), eq(clonedVoices.status, "completed")));
    if (!ownedVoice) throw new Error("Cloned voice not found or not ready yet");
    verifiedPersonaId = personaId;
  }

  const isCustom = (!!lyrics?.trim() && !instrumental) || !!verifiedPersonaId;
  const genResult = await createApimartGeneration({ prompt, custom: isCustom, version: providerModel || "v5", lyrics: isCustom ? lyrics : undefined, title: resolvedTitle || undefined, style: isCustom ? prompt : undefined, instrumental: instrumental || false, vocalGender: vocalGender && vocalGender !== "auto" ? vocalGender as "Male" | "Female" : undefined, personaId: verifiedPersonaId, weirdnessConstraint: typeof weirdness === "number" ? Math.round(weirdness) / 100 : undefined, styleWeight: typeof styleInfluence === "number" ? Math.round(styleInfluence) / 100 : undefined, audioWeight: typeof audioWeight === "number" ? Math.round(audioWeight) / 100 : undefined, negativeTags: typeof negativeTags === "string" && negativeTags.trim() ? negativeTags.trim() : undefined });

  const [t1, t2] = await Promise.all([
    db.update(tracks).set({ status: "generating", jobId: genResult.taskId }).where(eq(tracks.id, track.id!)).returning(),
    db.insert(tracks).values({ userId, provider: "apimart", providerModel, prompt, lyrics: instrumental ? null : (lyrics || null), instrumental, title: resolvedTitle ? `${resolvedTitle} (2)` : null, artistName: resolvedArtistName, writerName: resolvedWriterName, status: "generating", jobId: `${genResult.taskId}:1` }).returning(),
  ]);

  const allTracks = [t1[0], t2[0]];
  spawnCoverArtBatchAsync(allTracks.map((t) => ({ id: t.id!, userId: t.userId, prompt: t.prompt, instrumental: t.instrumental })), resolvedTitle, "apimart");

  await logApi({ userId, type: "generation", provider: "apimart", endpoint: "/api/generate", request: JSON.stringify({ provider, providerModel, prompt }), response: JSON.stringify({ status: "generating", taskId: genResult.taskId }), statusCode: 200, duration: Date.now() - startTime });
  return NextResponse.json({ tracks: allTracks });
}
