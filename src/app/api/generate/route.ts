import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateLyria } from "@/lib/providers/lyria";
import { generatePoYo } from "@/lib/providers/poyo";
import { generateTempolor } from "@/lib/providers/tempolor";
import { uploadToS3 } from "@/lib/s3";
import { logApi } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const decoded = verifyToken(token || "");

  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { provider, providerModel, prompt, lyrics, instrumental, title } = body;

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

  const result = await db
    .insert(tracks)
    .values({
      userId: decoded.userId,
      provider,
      providerModel,
      prompt,
      lyrics: lyrics || null,
      instrumental: instrumental || false,
      title: title || null,
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

      const s3Key = `tracks/${track.id}/audio.mp3`;
      await uploadToS3(s3Key, genResult.audioBuffer);

      const updated = await db
        .update(tracks)
        .set({
          status: "done",
          s3Key,
          audioUrl: `/api/tracks/${track.id}/download`,
          duration: genResult.duration,
        })
        .where(eq(tracks.id, track.id!))
        .returning();

      await logApi({
        userId: decoded.userId,
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
        model: providerModel,
      });

      const updated = await db
        .update(tracks)
        .set({
          status: "generating",
          jobId: genResult.jobId,
        })
        .where(eq(tracks.id, track.id!))
        .returning();

      await logApi({
        userId: decoded.userId,
        type: "generation",
        provider: "poyo",
        endpoint: "/api/generate",
        request: JSON.stringify({ provider, providerModel, prompt }),
        response: JSON.stringify({ status: "generating", jobId: genResult.jobId }),
        statusCode: 200,
        duration: Date.now() - startTime,
      });

      return NextResponse.json({ track: updated[0] });
    }

    if (provider === "tempolor") {
      genResult = await generateTempolor({
        prompt,
        lyrics,
        instrumental,
        model: providerModel,
      });

      const updated = await db
        .update(tracks)
        .set({
          status: "generating",
          jobId: genResult.jobId,
        })
        .where(eq(tracks.id, track.id!))
        .returning();

      await logApi({
        userId: decoded.userId,
        type: "generation",
        provider: "tempolor",
        endpoint: "/api/generate",
        request: JSON.stringify({ provider, providerModel, prompt }),
        response: JSON.stringify({ status: "generating", jobId: genResult.jobId }),
        statusCode: 200,
        duration: Date.now() - startTime,
      });

      return NextResponse.json({ track: updated[0] });
    }

    return NextResponse.json(
      { error: "Unknown provider" },
      { status: 400 }
    );
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
      userId: decoded.userId,
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
