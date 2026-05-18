export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateLyria } from "@/lib/providers/lyria";
import { generatePoYo } from "@/lib/providers/poyo";
import { generateTempolor } from "@/lib/providers/tempolor";
import { generateMusicGpt } from "@/lib/providers/musicgpt";
import { generateAndSaveCoverArt } from "@/lib/generate-cover";
import { uploadToS3 } from "@/lib/s3";
import { logApi } from "@/lib/logger";
import { requireAuth } from "@/lib/require-auth";
import { getWebhookUrl, validateProviderApiKeys } from "@/lib/settings";
import { contentTypeForFormat, detectFormatFromContentType } from "@/lib/audio-format";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
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

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  if (!checkRateLimit(userId)) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  const body = await request.json();
  const { provider, providerModel, prompt, lyrics, instrumental, title } = body;
  const resolvedTitle = title?.trim() || (provider === "poyo" ? prompt.trim().slice(0, 80) : null);
  const allowedProviders = ["lyria", "poyo", "tempolor", "musicgpt"];
  const poyoValidModels = ["V4", "V4_5", "V4_SALL", "V4_SPLUS", "V5", "V5_5"];
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
  if (title !== undefined && title !== null && (typeof title !== "string" || title.length > 255)) {
    return NextResponse.json({ error: "title must be 255 characters or fewer" }, { status: 400 });
  }
  if (instrumental && (!resolvedTitle || !resolvedTitle.trim())) {
    return NextResponse.json({ error: "title is required for instrumental tracks" }, { status: 400 });
  }
  if (!allowedProviders.includes(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  if (provider === "poyo" && !poyoValidModels.includes(normalizedPoYoModel)) {
    return NextResponse.json(
      { error: `Invalid PoYo model. Supported: ${poyoValidModels.join(", ")}` },
      { status: 400 }
    );
  }

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
    let genResult: any;

    if (provider === "lyria") {
      genResult = await generateLyria({
        prompt,
        lyrics,
        instrumental,
        model: providerModel,
      });

      const format = detectFormatFromContentType(genResult.mimeType || "audio/mpeg");
      const s3Key = `tracks/${track.id}/audio.${format}`;
      await uploadToS3(s3Key, genResult.audioBuffer, contentTypeForFormat(format));

      const updated = await db
        .update(tracks)
        .set({
          status: "done",
          s3Key,
          format,
          audioUrl: `/api/tracks/${track.id}/download`,
          duration: genResult.duration,
        })
        .where(eq(tracks.id, track.id!))
        .returning();

      generateAndSaveCoverArt({
        id: track.id,
        userId: track.userId,
        title: resolvedTitle,
        prompt,
        instrumental: instrumental || false,
      }).catch(() => {});

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

    if (provider === "poyo") {
      genResult = await generatePoYo({
        prompt,
        lyrics,
        instrumental,
        model: normalizedPoYoModel,
        title: resolvedTitle || undefined,
      });

      const primaryJobId = genResult.jobIds?.[0];
      if (!primaryJobId) {
        throw new Error("PoYo returned no job IDs");
      }

      const updated = await db
        .update(tracks)
        .set({
          status: "generating",
          jobId: primaryJobId,
        })
        .where(eq(tracks.id, track.id!))
        .returning();

      await logApi({
        userId: userId,
        type: "generation",
        provider: "poyo",
        endpoint: "/api/generate",
        request: JSON.stringify({ provider, providerModel, prompt }),
        response: JSON.stringify({ status: "generating", jobId: primaryJobId }),
        statusCode: 200,
        duration: Date.now() - startTime,
      });

      return NextResponse.json({ tracks: [updated[0]] });
    }

    if (provider === "tempolor") {
      genResult = await generateTempolor({
        prompt,
        lyrics,
        instrumental,
        model: providerModel,
      });

      const jobIds: string[] = genResult.jobIds;
      if (!Array.isArray(jobIds) || jobIds.length === 0) {
        throw new Error("Tempolor returned no job IDs");
      }

      const updated = await db
        .update(tracks)
        .set({
          status: "generating",
          jobId: jobIds[0],
        })
        .where(eq(tracks.id, track.id!))
        .returning();

      let extraInserted: typeof updated = [];
      if (jobIds.length > 1) {
        const baseTitle = resolvedTitle || track.title || "Generated Track";
        extraInserted = await db
          .insert(tracks)
          .values(
            jobIds.slice(1).map((jobId: string, index: number) => ({
              userId: track.userId,
              provider: track.provider,
              providerModel: track.providerModel,
              prompt: track.prompt,
              lyrics: track.lyrics,
              instrumental: track.instrumental,
              language: track.language,
              status: "generating" as const,
              jobId,
              title: `${baseTitle} (${index + 2})`,
            }))
          )
          .returning();
      }

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

      return NextResponse.json({ tracks: [updated[0], ...extraInserted] });
    }

    if (provider === "musicgpt") {
      const webhookUrl = await getWebhookUrl("musicgpt");
      
      genResult = await generateMusicGpt({
        prompt,
        lyrics,
        instrumental,
        gender: body.gender || "",
        webhookUrl,
      });

      const updated = await db
        .update(tracks)
        .set({
          status: "generating",
          jobId: genResult.taskId,
        })
        .where(eq(tracks.id, track.id!))
        .returning();

      await logApi({
        userId: userId,
        type: "generation",
        provider: "musicgpt",
        endpoint: "/api/generate",
        request: JSON.stringify({ provider, providerModel, prompt }),
        response: JSON.stringify({ status: "generating", jobId: genResult.taskId }),
        statusCode: 200,
        duration: Date.now() - startTime,
      });

      return NextResponse.json({ track: updated[0] });
    }

    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  } catch (error: any) {
    const isCopyright = error.message === "COPYRIGHT";

    await db
      .update(tracks)
      .set({
        status: "failed",
        error: isCopyright
          ? "Copyright detected → click Optimize in Studio to rewrite safely"
          : error.message || "Generation failed",
      })
      .where(eq(tracks.id, track.id!));

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
        error: isCopyright
          ? "Copyright detected → click Optimize in Studio to rewrite safely"
          : error.message || "Generation failed",
        trackId: track.id,
      },
      { status: isCopyright ? 400 : 500 }
    );
  }
}
