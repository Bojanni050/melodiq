import { NextRequest, NextResponse } from "next/server";
import fs from "fs";

import { getPublishedTrackById } from "@/lib/songs";
import { getCachedAudioStream, getContentType } from "@/lib/audio-cache";
import { resolveTrackAudioSource } from "@/lib/audio-format";
import { getPresignedUrl } from "@/lib/s3";

// Public, no auth: only ever serves audio for a track with
// releaseStatus === "published" — re-verified on every request via
// getPublishedTrackById, never trusting client-supplied state.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const { trackId } = await params;

  const track = await getPublishedTrackById(trackId);
  if (!track) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const resolved = resolveTrackAudioSource(track);
  if (!resolved || !resolved.s3Key) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { s3Key, format: fmt } = resolved;

  try {
    const { filePath, stream, cached, size } = await getCachedAudioStream(s3Key, fmt);
    const contentType = getContentType(fmt);
    const cacheState = cached ? "hit" : "miss";

    const rangeHeader = request.headers.get("range");
    const fileSize = size;

    if (rangeHeader) {
      stream.destroy();

      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (!cached) {
        // The disk copy may still be mid-write in the background — proxy
        // the ranged request straight from S3 instead of racing it.
        const presignedUrl = await getPresignedUrl(s3Key);
        const s3Response = await fetch(presignedUrl, { headers: { Range: rangeHeader } });
        if (!s3Response.ok || !s3Response.body) {
          return NextResponse.json({ error: "Failed to stream audio" }, { status: 502 });
        }
        return new NextResponse(s3Response.body, {
          status: s3Response.status === 206 ? 206 : 200,
          headers: {
            "Content-Type": s3Response.headers.get("content-type") || contentType,
            ...(s3Response.headers.get("content-length") ? { "Content-Length": s3Response.headers.get("content-length")! } : {}),
            ...(s3Response.headers.get("content-range") ? { "Content-Range": s3Response.headers.get("content-range")! } : {}),
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=31536000, immutable",
            "x-melodiq-audio-source": "s3",
            "x-melodiq-audio-cache-state": "miss",
          },
        });
      }

      const chunkSize = end - start + 1;
      const readStream = fs.createReadStream(filePath, { start, end });
      const readable = new ReadableStream({
        start(controller) {
          readStream.on("data", (chunk) => controller.enqueue(chunk));
          readStream.on("end", () => controller.close());
          readStream.on("error", (err) => controller.error(err));
        },
      });

      return new NextResponse(readable, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
          "x-melodiq-audio-source": "cache",
          "x-melodiq-audio-cache-state": cacheState,
        },
      });
    }

    const readable = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(readable, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileSize),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
        "x-melodiq-audio-source": "cache",
        "x-melodiq-audio-cache-state": cacheState,
      },
    });
  } catch (error) {
    console.error("[discover/stream] cache error, falling back to direct S3 stream:", error);

    try {
      const presignedUrl = await getPresignedUrl(s3Key);
      const s3Response = await fetch(presignedUrl, {
        headers: request.headers.get("range")
          ? { Range: request.headers.get("range") as string }
          : undefined,
      });

      if (!s3Response.ok || !s3Response.body) {
        return NextResponse.json({ error: "Failed to stream audio" }, { status: 502 });
      }

      const fallbackContentType = s3Response.headers.get("content-type") || getContentType(fmt);
      const fallbackContentLength = s3Response.headers.get("content-length");
      const fallbackContentRange = s3Response.headers.get("content-range");
      const fallbackStatus = s3Response.status === 206 ? 206 : 200;

      return new NextResponse(s3Response.body, {
        status: fallbackStatus,
        headers: {
          "Content-Type": fallbackContentType,
          ...(fallbackContentLength ? { "Content-Length": fallbackContentLength } : {}),
          ...(fallbackContentRange ? { "Content-Range": fallbackContentRange } : {}),
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=300",
          "x-melodiq-audio-source": "s3",
          "x-melodiq-audio-cache-state": "fallback",
        },
      });
    } catch (fallbackError) {
      console.error("[discover/stream] direct S3 fallback failed:", fallbackError);
      return NextResponse.json({ error: "Failed to stream audio" }, { status: 502 });
    }
  }
}
