import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const track = await prisma.track.create({
    data: {
      userId: decoded.userId,
      provider,
      providerModel,
      prompt,
      lyrics: lyrics || null,
      instrumental: instrumental || false,
      title: title || null,
      status: "pending",
    },
  });

  try {
    let result: any;

    if (provider === "lyria") {
      result = await generateLyria({
        prompt,
        lyrics,
        instrumental,
        model: providerModel,
      });

      const s3Key = `tracks/${track.id}/audio.mp3`;
      await uploadToS3(s3Key, result.audioBuffer);

      const updated = await prisma.track.update({
        where: { id: track.id },
        data: {
          status: "done",
          s3Key,
          audioUrl: `/api/tracks/${track.id}/download`,
          duration: result.duration,
        },
      });

      await logApi({
        userId: decoded.userId,
        type: "generation",
        provider: "lyria",
        endpoint: "/api/generate",
        request: JSON.stringify({ provider, providerModel, prompt }),
        response: JSON.stringify({ status: "done", trackId: updated.id }),
        statusCode: 200,
        duration: Date.now() - startTime,
      });

      return NextResponse.json({ track: updated });
    }

    if (provider === "poyo") {
      result = await generatePoYo({
        prompt,
        lyrics,
        instrumental,
        model: providerModel,
      });

      const updated = await prisma.track.update({
        where: { id: track.id },
        data: {
          status: "generating",
          jobId: result.jobId,
        },
      });

      await logApi({
        userId: decoded.userId,
        type: "generation",
        provider: "poyo",
        endpoint: "/api/generate",
        request: JSON.stringify({ provider, providerModel, prompt }),
        response: JSON.stringify({ status: "generating", jobId: result.jobId }),
        statusCode: 200,
        duration: Date.now() - startTime,
      });

      return NextResponse.json({ track: updated });
    }

    if (provider === "tempolor") {
      result = await generateTempolor({
        prompt,
        lyrics,
        instrumental,
        model: providerModel,
      });

      const updated = await prisma.track.update({
        where: { id: track.id },
        data: {
          status: "generating",
          jobId: result.jobId,
        },
      });

      await logApi({
        userId: decoded.userId,
        type: "generation",
        provider: "tempolor",
        endpoint: "/api/generate",
        request: JSON.stringify({ provider, providerModel, prompt }),
        response: JSON.stringify({ status: "generating", jobId: result.jobId }),
        statusCode: 200,
        duration: Date.now() - startTime,
      });

      return NextResponse.json({ track: updated });
    }

    return NextResponse.json(
      { error: "Unknown provider" },
      { status: 400 }
    );
  } catch (error: any) {
    const isCopyright = error.message === "COPYRIGHT";

    await prisma.track.update({
      where: { id: track.id },
      data: {
        status: "failed",
        error: isCopyright
          ? "Copyright detected → click Optimize in Studio to rewrite safely"
          : error.message || "Generation failed",
      },
    });

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
