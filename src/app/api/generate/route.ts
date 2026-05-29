export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateLyria } from "@/lib/providers/lyria";
import { generatePoYo, generateMinimaxMusic26 } from "@/lib/providers/poyo";
import { generateTempolor } from "@/lib/providers/tempolor";
import { generateMusicGpt } from "@/lib/providers/musicgpt";
import { generateMinimax } from "@/lib/providers/minimax";
import { generateMureka } from "@/lib/providers/mureka";
import { generateAndSaveCoverArt, generateAndSaveCoverArtForBatch } from "@/lib/generate-cover";
import { uploadToS3 } from "@/lib/s3";
import { logApi } from "@/lib/logger";
import { requireAuth } from "@/lib/require-auth";
import { getSetting, getWebhookUrl, validateProviderApiKeys } from "@/lib/settings";
import { callLLM } from "@/lib/providers/llm";
import { contentTypeForFormat, detectFormatFromContentType } from "@/lib/audio-format";
import { extractAudioDuration } from "@/lib/audio-duration";

const RATE_LIMIT_WINDOW_MS = 60_000;
// Note: this resets on container restart. For multi-container setups, use Redis instead.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Purge stale entries every 5 minutes to prevent unbounded memory growth
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
      if (now > entry.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    if (rateLimitMap.size > 500) {
      for (const [key, val] of rateLimitMap.entries()) {
        if (Date.now() > val.resetAt) rateLimitMap.delete(key);
      }
    }
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

function deriveInstrumentalTitleFallbackFromPrompt(prompt: string): string | null {
  const cleanedPrompt = prompt
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanedPrompt) return null;

  const primarySegment = cleanedPrompt
    .split(/[\n,;|]/)
    .map((segment) => segment.trim())
    .find(Boolean) || cleanedPrompt;

  const limitedWords = primarySegment.split(/\s+/).slice(0, 8).join(" ").trim();
  if (!limitedWords) return null;

  const capped = limitedWords.slice(0, 80).trim();
  return capped ? capped[0].toUpperCase() + capped.slice(1) : null;
}

function normalizeAiTitle(raw: string): string | null {
  const firstLine = raw.split(/\r?\n/).find((line) => line.trim()) || "";
  const cleaned = firstLine
    .replace(/^["'`\s]+|["'`\s]+$/g, "")
    .replace(/[\[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;
  return cleaned.slice(0, 80).trim();
}

async function generateInstrumentalTitleFromPrompt(prompt: string): Promise<string | null> {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) return null;

  const systemPrompt = `You generate concise song titles for instrumental tracks.

Rules:
- Return only the title
- No quotes, no punctuation at the end, no explanation
- Maximum 6 words
- Keep it evocative and based on the style prompt`;

  const userPrompt = `Create one instrumental track title from this style prompt:\n\n${trimmedPrompt}`;

  try {
    const rawTitle = await callLLM(userPrompt, systemPrompt, { purpose: "prompt", temperature: 0.4 });
    return normalizeAiTitle(rawTitle);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  if (!checkRateLimit(userId)) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  const body = await request.json();
  const { provider, providerModel, prompt, lyrics, instrumental, title, vocalGender, weirdness, styleInfluence } = body;
  const normalizedPrompt = typeof prompt === "string" ? prompt.trim() : "";
  const normalizedTitle = typeof title === "string" ? title.trim() : "";
  const allowedProviders = ["lyria", "poyo", "tempolor", "musicgpt", "minimax", "mureka"];
  const poyoValidModels = ["V4", "V4_5", "V4_SALL", "V4_SPLUS", "V5", "V5_5"];
  const isMinimaxViaPoYo = provider === "poyo" && providerModel === "minimax-music-2.6";
  const normalizedPoYoModel = providerModel?.toUpperCase().replace(/\./g, "_") || "V5_5";

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (prompt.length > 2000) {
    return NextResponse.json({ error: "prompt must be 2000 characters or fewer" }, { status: 400 });
  }
  if (lyrics !== undefined && lyrics !== null && (typeof lyrics !== "string" || lyrics.length > 10000)) {
    return NextResponse.json({ error: "lyrics must be 10000 characters or fewer" }, { status: 400 });
  }
  if (provider === "musicgpt" && typeof lyrics === "string" && lyrics.length > 3000) {
    return NextResponse.json({ error: "MusicGPT lyrics must be 3000 characters or fewer" }, { status: 400 });
  }
  if (provider === "minimax" && typeof lyrics === "string" && lyrics.length > 3000) {
    return NextResponse.json({ error: "Minimax lyrics must be 3000 characters or fewer" }, { status: 400 });
  }
  if (isMinimaxViaPoYo && typeof lyrics === "string" && lyrics.length > 3500) {
    return NextResponse.json({ error: "Minimax via PoYo lyrics must be 3500 characters or fewer" }, { status: 400 });
  }
  if (title !== undefined && title !== null && (typeof title !== "string" || title.length > 255)) {
    return NextResponse.json({ error: "title must be 255 characters or fewer" }, { status: 400 });
  }
  if (!allowedProviders.includes(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  if (provider === "poyo" && !isMinimaxViaPoYo && !poyoValidModels.includes(normalizedPoYoModel)) {
    return NextResponse.json(
      { error: `Invalid PoYo model. Supported: ${poyoValidModels.join(", ")}` },
      { status: 400 }
    );
  }

  const aiInstrumentalTitle =
    !normalizedTitle && instrumental
      ? await generateInstrumentalTitleFromPrompt(normalizedPrompt)
      : null;
  const derivedInstrumentalTitle = instrumental
    ? deriveInstrumentalTitleFallbackFromPrompt(normalizedPrompt)
    : null;
  const resolvedTitle =
    normalizedTitle ||
    aiInstrumentalTitle ||
    derivedInstrumentalTitle ||
    (provider === "poyo" && normalizedPrompt ? normalizedPrompt.slice(0, 80) : null);

  // Validate that required API keys are configured
  const validation = await validateProviderApiKeys(provider);
  if (!validation.valid) {
    return NextResponse.json(
      {
        error: `Missing API configuration: ${validation.missing.join(", ")}. Please configure these in Settings.`,
      },
      { status: 400 }
    );
  }

  if (isMinimaxViaPoYo) {
    const insertResult = await db
      .insert(tracks)
      .values({
        userId,
        provider,
        providerModel,
        prompt,
        lyrics: lyrics || null,
        instrumental: instrumental || false,
        title: resolvedTitle,
        status: "pending",
      })
      .returning();

    const track = insertResult[0];

    const reservedTrack = await db
      .update(tracks)
      .set({
        s3Key: `tracks/${track.id}/audio.mp3`,
        s3KeyHd: `tracks/${track.id}/audio_hd.wav`,
        format: "mp3",
        formatHd: "wav",
        audioUrl: `/api/tracks/${track.id}/download`,
        audioUrlHd: `/api/tracks/${track.id}/download?hd=true`,
      })
      .where(eq(tracks.id, track.id!))
      .returning();

    try {
      const genResult = await generateMinimaxMusic26({
        prompt,
        lyrics,
        instrumental,
      });

      const jobIds: string[] = genResult.jobIds;
      const [baseJobId] = jobIds;
      if (!baseJobId) {
        throw {
          message: "Minimax via PoYo returned no task ID",
          duration: Date.now() - startTime,
          statusCode: 500,
        };
      }

      const updatedTrack = await db
        .update(tracks)
        .set({ status: "generating", jobId: baseJobId, error: null })
        .where(eq(tracks.id, reservedTrack[0].id!))
        .returning();

      const allTracks = [updatedTrack[0]];

      generateAndSaveCoverArtForBatch({
        tracks: allTracks.map((t) => ({
          id: t.id!,
          userId: t.userId,
          prompt: t.prompt,
          title: resolvedTitle,
          instrumental: t.instrumental,
        })),
      }).catch((error) => console.error("[generate] cover art batch failed (minimax via poyo)", error));

      await logApi({
        userId,
        type: "generation",
        provider: "poyo",
        endpoint: "/api/generate",
        request: JSON.stringify({ provider, providerModel: "minimax-music-2.6", prompt }),
        response: JSON.stringify({ status: "generating", jobIds }),
        statusCode: 200,
        duration: Date.now() - startTime,
      });

      return NextResponse.json({ tracks: allTracks });
    } catch (error: any) {
      const isCopyright = error.message === "COPYRIGHT";
      const errorMessage = isCopyright
        ? "Copyright detected → click Optimize in Studio to rewrite safely"
        : error.message || "Generation failed";

      const deletedPending = await db
        .delete(tracks)
        .where(and(eq(tracks.id, reservedTrack[0].id!), eq(tracks.status, "pending")))
        .returning({ id: tracks.id });

      if (deletedPending.length === 0) {
        await db
          .update(tracks)
          .set({
            status: "failed",
            error: errorMessage,
          })
          .where(eq(tracks.id, reservedTrack[0].id!));
      }

      await logApi({
        userId,
        type: "generation",
        provider: "poyo",
        endpoint: "/api/generate",
        request: JSON.stringify({ provider, providerModel: "minimax-music-2.6", prompt }),
        response: JSON.stringify({ error: error.message }),
        statusCode: error.statusCode || 500,
        duration: Date.now() - startTime,
      });

      return NextResponse.json(
        {
          error: errorMessage,
        },
        { status: isCopyright ? 400 : 500 }
      );
    }
  }

  if (provider === "poyo") {
    const [firstInsertResult, secondInsertResult] = await Promise.all([
      db
        .insert(tracks)
        .values({
          userId,
          provider,
          providerModel,
          prompt,
          lyrics: lyrics || null,
          instrumental: instrumental || false,
          title: resolvedTitle,
          status: "pending",
        })
        .returning(),
      db
        .insert(tracks)
        .values({
          userId,
          provider,
          providerModel,
          prompt,
          lyrics: lyrics || null,
          instrumental: instrumental || false,
          title: resolvedTitle ? `${resolvedTitle} (2)` : null,
          status: "pending",
        })
        .returning(),
    ]);

    const track1 = firstInsertResult[0];
    const track2 = secondInsertResult[0];

    const [reservedTrack1, reservedTrack2] = await Promise.all([
      db
        .update(tracks)
        .set({
          s3Key: `tracks/${track1.id}/audio.mp3`,
          s3KeyHd: `tracks/${track1.id}/audio_hd.wav`,
          format: "mp3",
          formatHd: "wav",
          audioUrl: `/api/tracks/${track1.id}/download`,
          audioUrlHd: `/api/tracks/${track1.id}/download?hd=true`,
        })
        .where(eq(tracks.id, track1.id!))
        .returning(),
      db
        .update(tracks)
        .set({
          s3Key: `tracks/${track2.id}/audio.mp3`,
          s3KeyHd: `tracks/${track2.id}/audio_hd.wav`,
          format: "mp3",
          formatHd: "wav",
          audioUrl: `/api/tracks/${track2.id}/download`,
          audioUrlHd: `/api/tracks/${track2.id}/download?hd=true`,
        })
        .where(eq(tracks.id, track2.id!))
        .returning(),
    ]);

    try {
      const genResult = await generatePoYo({
        prompt,
        lyrics,
        instrumental,
        model: normalizedPoYoModel,
        title: resolvedTitle || undefined,
        gender: vocalGender && vocalGender !== "auto" ? vocalGender : undefined,
        weirdness: typeof weirdness === "number" ? Math.round(weirdness) / 100 : undefined,
        styleInfluence: typeof styleInfluence === "number" ? Math.round(styleInfluence) / 100 : undefined,
      });

      const jobIds: string[] = genResult.jobIds;
      const [baseJobId] = jobIds;
      if (!baseJobId) {
        throw {
          message: "PoYo returned no task ID",
          duration: Date.now() - startTime,
          statusCode: 500,
        };
      }
      const secondVariantJobId = jobIds[1] ?? `${baseJobId}:v2`;

      const [updatedTrack1Result, updatedTrack2Result] = await Promise.all([
        db
          .update(tracks)
          .set({ status: "generating", jobId: baseJobId, error: null })
          .where(eq(tracks.id, reservedTrack1[0].id!))
          .returning(),
        db
          .update(tracks)
          .set({ status: "generating", jobId: secondVariantJobId, error: null })
          .where(eq(tracks.id, reservedTrack2[0].id!))
          .returning(),
      ]);

      const allTracks = [updatedTrack1Result[0], updatedTrack2Result[0]];

      generateAndSaveCoverArtForBatch({
        tracks: allTracks.map((t) => ({
          id: t.id!,
          userId: t.userId,
          prompt: t.prompt,
          title: resolvedTitle,
          instrumental: t.instrumental,
        })),
      }).catch((error) => console.error("[generate] cover art batch failed (poyo)", error));

      await logApi({
        userId,
        type: "generation",
        provider: "poyo",
        endpoint: "/api/generate",
        request: JSON.stringify({ provider, providerModel, prompt }),
        response: JSON.stringify({ status: "generating", jobIds }),
        statusCode: 200,
        duration: Date.now() - startTime,
      });

      return NextResponse.json({ tracks: allTracks });
    } catch (error: any) {
      const isCopyright = error.message === "COPYRIGHT";
      const errorMessage = isCopyright
        ? "Copyright detected → click Optimize in Studio to rewrite safely"
        : error.message || "Generation failed";

      const [deletedPending1, deletedPending2] = await Promise.all([
        db
          .delete(tracks)
          .where(and(eq(tracks.id, reservedTrack1[0].id!), eq(tracks.status, "pending")))
          .returning({ id: tracks.id }),
        db
          .delete(tracks)
          .where(and(eq(tracks.id, reservedTrack2[0].id!), eq(tracks.status, "pending")))
          .returning({ id: tracks.id }),
      ]);

      await Promise.all([
        deletedPending1.length === 0
          ? db
              .update(tracks)
              .set({
                status: "failed",
                error: errorMessage,
              })
              .where(eq(tracks.id, reservedTrack1[0].id!))
          : Promise.resolve(),
        deletedPending2.length === 0
          ? db
              .update(tracks)
              .set({
                status: "failed",
                error: errorMessage,
              })
              .where(eq(tracks.id, reservedTrack2[0].id!))
          : Promise.resolve(),
      ]);

      await logApi({
        userId,
        type: "generation",
        provider,
        endpoint: "/api/generate",
        request: JSON.stringify({ provider, providerModel, prompt }),
        response: JSON.stringify({ error: error.message }),
        statusCode: error.statusCode || 500,
        duration: Date.now() - startTime,
      });

      return NextResponse.json(
        {
          error: errorMessage,
        },
        { status: isCopyright ? 400 : 500 }
      );
    }
  }

  const result = await db
    .insert(tracks)
    .values({
      userId: userId,
      provider,
      providerModel,
      prompt,
      lyrics: lyrics || null,
      instrumental: instrumental || false,
      title: resolvedTitle,
      status: "pending",
    })
    .returning();

  const track = result[0];

  try {
    if (provider === "lyria") {
      const genResult = await generateLyria({
        prompt,
        lyrics,
        instrumental,
        model: providerModel,
        returnBothFormats: true,
      });

      // Upload MP3 version (and WAV if available) in parallel
      const format = detectFormatFromContentType(genResult.mimeType || "audio/mpeg");
      const s3Key = `tracks/${track.id}/audio.${format}`;

      let s3KeyHd: string | null = null;
      let formatHd: "mp3" | "wav" | null = null;
      let audioUrlHd: string | null = null;
      if (genResult.audioBufferHd && genResult.mimeTypeHd) {
        formatHd = detectFormatFromContentType(genResult.mimeTypeHd);
        s3KeyHd = `tracks/${track.id}/audio_hd.${formatHd}`;
        audioUrlHd = `/api/tracks/${track.id}/download?hd=true`;
      }

      await Promise.all([
        uploadToS3(s3Key, genResult.audioBuffer, contentTypeForFormat(format)),
        ...(s3KeyHd && formatHd && genResult.audioBufferHd
          ? [uploadToS3(s3KeyHd, genResult.audioBufferHd, contentTypeForFormat(formatHd))]
          : []),
      ]);

      // Extract actual audio duration
      const audioDuration = await extractAudioDuration(genResult.audioBuffer);

      const updated = await db
        .update(tracks)
        .set({
          status: "done",
          s3Key,
          format,
          s3KeyHd,
          formatHd,
          audioUrl: `/api/tracks/${track.id}/download`,
          audioUrlHd,
          duration: audioDuration,
        })
        .where(eq(tracks.id, track.id!))
        .returning();

      generateAndSaveCoverArt({
        id: track.id,
        userId: track.userId,
        title: resolvedTitle,
        prompt,
        instrumental: instrumental || false,
      }).catch((error) => console.error("[generate] cover art generation failed (lyria)", error));

      await logApi({
        userId: userId,
        type: "generation",
        provider: "lyria",
        endpoint: "/api/generate",
        request: JSON.stringify({ provider, providerModel, prompt }),
        response: JSON.stringify({ status: "done", trackId: updated[0].id }),
        statusCode: 200,
        duration: Date.now() - startTime,
      });

      return NextResponse.json({ track: updated[0] });
    }

    if (provider === "minimax") {
      const usePoYo = await getSetting("MINIMAX_USE_POYO");

      if (usePoYo === "true") {
        // Route via PoYo API — async with webhook
        const reservedTrack = await db
          .update(tracks)
          .set({
            s3Key: `tracks/${track.id}/audio.mp3`,
            s3KeyHd: `tracks/${track.id}/audio_hd.wav`,
            format: "mp3",
            formatHd: "wav",
            audioUrl: `/api/tracks/${track.id}/download`,
            audioUrlHd: `/api/tracks/${track.id}/download?hd=true`,
          })
          .where(eq(tracks.id, track.id!))
          .returning();

        try {
          const genResult = await generateMinimaxMusic26({
            prompt,
            lyrics,
            instrumental,
          });

          const jobIds: string[] = genResult.jobIds;
          const [baseJobId] = jobIds;
          if (!baseJobId) {
            throw {
              message: "Minimax via PoYo returned no task ID",
              duration: Date.now() - startTime,
              statusCode: 500,
            };
          }

          const updatedTrack = await db
            .update(tracks)
            .set({ status: "generating", jobId: baseJobId, error: null, provider: "poyo", providerModel: "minimax-music-2.6" })
            .where(eq(tracks.id, reservedTrack[0].id!))
            .returning();

          const allTracks = [updatedTrack[0]];

          generateAndSaveCoverArtForBatch({
            tracks: allTracks.map((t) => ({
              id: t.id!,
              userId: t.userId,
              prompt: t.prompt,
              title: resolvedTitle,
              instrumental: t.instrumental,
            })),
          }).catch((error) => console.error("[generate] cover art batch failed (minimax via poyo)", error));

          await logApi({
            userId,
            type: "generation",
            provider: "minimax",
            endpoint: "/api/generate",
            request: JSON.stringify({ provider, providerModel, prompt }),
            response: JSON.stringify({ status: "generating", jobIds }),
            statusCode: 200,
            duration: Date.now() - startTime,
          });

          return NextResponse.json({ tracks: allTracks });
        } catch (error: any) {
          const isCopyright = error.message === "COPYRIGHT";
          const errorMessage = isCopyright
            ? "Copyright detected → click Optimize in Studio to rewrite safely"
            : error.message || "Generation failed";

          const deletedPending = await db
            .delete(tracks)
            .where(and(eq(tracks.id, reservedTrack[0].id!), eq(tracks.status, "pending")))
            .returning({ id: tracks.id });

          if (deletedPending.length === 0) {
            await db
              .update(tracks)
              .set({ status: "failed", error: errorMessage })
              .where(eq(tracks.id, reservedTrack[0].id!));
          }

          await logApi({
            userId,
            type: "generation",
            provider: "minimax",
            endpoint: "/api/generate",
            request: JSON.stringify({ provider, providerModel, prompt }),
            response: JSON.stringify({ error: error.message }),
            statusCode: error.statusCode || 500,
            duration: Date.now() - startTime,
          });

          return NextResponse.json(
            { error: errorMessage },
            { status: isCopyright ? 400 : 500 }
          );
        }
      } else {
        // Direct Minimax API — synchronous
        const genResult = await generateMinimax({
          prompt,
          lyrics,
          instrumental,
        });

        const format = detectFormatFromContentType(genResult.mimeType || "audio/mpeg");
        const s3Key = `tracks/${track.id}/audio.${format}`;
        await uploadToS3(s3Key, genResult.audioBuffer, contentTypeForFormat(format));

        const audioDuration = await extractAudioDuration(genResult.audioBuffer);

        const updated = await db
          .update(tracks)
          .set({
            status: "done",
            s3Key,
            format,
            audioUrl: `/api/tracks/${track.id}/download`,
            duration: audioDuration,
          })
          .where(eq(tracks.id, track.id!))
          .returning();

        generateAndSaveCoverArt({
          id: track.id,
          userId: track.userId,
          title: resolvedTitle,
          prompt,
          instrumental: instrumental || false,
        }).catch((error) => console.error("[generate] cover art generation failed (minimax)", error));

        await logApi({
          userId: userId,
          type: "generation",
          provider: "minimax",
          endpoint: "/api/generate",
          request: JSON.stringify({ provider, providerModel, prompt }),
          response: JSON.stringify({ status: "done", trackId: updated[0].id }),
          statusCode: 200,
          duration: Date.now() - startTime,
        });

        return NextResponse.json({ track: updated[0] });
      }
    }

    if (provider === "tempolor") {
      const genResult = await generateTempolor({
        prompt,
        lyrics,
        instrumental,
        model: providerModel,
      });

      const jobIds: string[] = genResult.jobIds;

      const firstUpdated = await db
        .update(tracks)
        .set({ status: "generating", jobId: jobIds[0] })
        .where(eq(tracks.id, track.id!))
        .returning();

      const extraInserted = await Promise.all(
        jobIds.slice(1).map((jobId, i) =>
          db
            .insert(tracks)
            .values({
              userId,
              provider,
              providerModel,
              prompt,
              lyrics: lyrics || null,
              instrumental: instrumental || false,
              title: resolvedTitle,
              status: "generating",
              jobId,
            })
            .returning()
        )
      );

      const allTracks = [firstUpdated[0], ...extraInserted.map((r) => r[0])];

      // Start cover art direct - parallel aan audio generatie bij Tempolor
      // Een cover voor de hele batch, toegewezen aan alle tracks tegelijk
      generateAndSaveCoverArtForBatch({
        tracks: allTracks.map((t) => ({
          id: t.id!,
          userId: t.userId,
          prompt: t.prompt,
          title: resolvedTitle,
          instrumental: t.instrumental,
        })),
      }).catch((error) => console.error("[generate] cover art batch failed (tempolor)", error));

      await logApi({
        userId: userId,
        type: "generation",
        provider: "tempolor",
        endpoint: "/api/generate",
        request: JSON.stringify({ provider, providerModel, prompt }),
        response: JSON.stringify({ status: "generating", jobIds }),
        statusCode: 200,
        duration: Date.now() - startTime,
      });

      return NextResponse.json({ tracks: allTracks });
    }

    if (provider === "musicgpt") {
      const webhookUrl = await getWebhookUrl("musicgpt");
      
      const genResult = await generateMusicGpt({
        prompt,
        lyrics,
        instrumental,
        gender: vocalGender && vocalGender !== "auto" ? vocalGender : "",
        webhookUrl,
      });

      const updated = await db
        .update(tracks)
        .set({
          status: "generating",
          jobId: genResult.taskId,
          conversionId: genResult.conversionId1,
        })
        .where(eq(tracks.id, track.id!))
        .returning();

      const track2 = await db
        .insert(tracks)
        .values({
          userId,
          provider: "musicgpt",
          providerModel,
          prompt,
          lyrics: lyrics || null,
          instrumental: instrumental || false,
          title: resolvedTitle,
          status: "generating",
          jobId: genResult.taskId,
          conversionId: genResult.conversionId2,
        })
        .returning();

      const allTracks = [updated[0], track2[0]];

      generateAndSaveCoverArtForBatch({
        tracks: allTracks.map((t) => ({
          id: t.id!,
          userId: t.userId,
          prompt: t.prompt,
          title: resolvedTitle,
          instrumental: t.instrumental,
        })),
      }).catch((error) => console.error("[generate] cover art batch failed (musicgpt)", error));

      await logApi({
        userId: userId,
        type: "generation",
        provider: "musicgpt",
        endpoint: "/api/generate",
        request: JSON.stringify({ provider, providerModel, prompt }),
        response: JSON.stringify({ status: "generating", taskId: genResult.taskId, conversions: [genResult.conversionId1, genResult.conversionId2] }),
        statusCode: 200,
        duration: Date.now() - startTime,
      });

      return NextResponse.json({ tracks: allTracks });
    }

    if (provider === "mureka") {
      if (!lyrics?.trim()) {
        return NextResponse.json({ error: "Mureka requires lyrics" }, { status: 400 });
      }

      const genResult = await generateMureka({
        lyrics,
        prompt: prompt || undefined,
        numberOfSongs: 2,
        outputFormat: "mp3",
      });

      const [t1, t2] = await Promise.all([
        db.update(tracks).set({ status: "generating", jobId: genResult.requestId }).where(eq(tracks.id, track.id!)).returning(),
        db.insert(tracks).values({
          userId,
          provider: "mureka",
          providerModel: "mureka-v9",
          prompt,
          lyrics: lyrics || null,
          instrumental: false,
          title: resolvedTitle ? `${resolvedTitle} (2)` : null,
          status: "generating",
          jobId: `${genResult.requestId}:1`,
        }).returning(),
      ]);

      const allTracks = [t1[0], t2[0]];

      generateAndSaveCoverArtForBatch({
        tracks: allTracks.map((t) => ({
          id: t.id!,
          userId: t.userId,
          prompt: t.prompt,
          title: resolvedTitle,
          instrumental: t.instrumental,
        })),
      }).catch((err) => console.error("[generate] cover art batch failed (mureka)", err));

      await logApi({
        userId,
        type: "generation",
        provider: "mureka",
        endpoint: "/api/generate",
        request: JSON.stringify({ provider, prompt, lyrics: lyrics?.slice(0, 100) }),
        response: JSON.stringify({ status: "generating", requestId: genResult.requestId }),
        statusCode: 200,
        duration: Date.now() - startTime,
      });

      return NextResponse.json({ tracks: allTracks });
    }

    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  } catch (error: any) {
    const isCopyright = error.message === "COPYRIGHT";
    const errorMessage = isCopyright
      ? "Copyright detected → click Optimize in Studio to rewrite safely"
      : error.message || "Generation failed";

    const deletedPending = await db
      .delete(tracks)
      .where(and(eq(tracks.id, track.id!), eq(tracks.status, "pending")))
      .returning({ id: tracks.id });

    if (deletedPending.length === 0) {
      await db
        .update(tracks)
        .set({
          status: "failed",
          error: errorMessage,
        })
        .where(eq(tracks.id, track.id!));
    }

    await logApi({
      userId: userId,
      type: "generation",
      provider,
      endpoint: "/api/generate",
      request: JSON.stringify({ provider, providerModel, prompt }),
      response: JSON.stringify({ error: error.message }),
      statusCode: error.statusCode || 500,
      duration: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: isCopyright ? 400 : 500 }
    );
  }
}
