import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import {
  getCachedAudioStream,
  getContentType,
  isCached,
} from "@/lib/audio-cache";
import { resolveTrackAudioSource } from "@/lib/audio-format";
import fs from "fs";
import { getPresignedUrl } from "@/lib/s3";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const hd = searchParams.get("hd") === "true";

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const result = await db
    // Only the fields resolveTrackAudioSource reads — the row's text blobs
    // are dead weight on every playback and seek request.
    .select({
      s3Key: tracks.s3Key,
      s3KeyHd: tracks.s3KeyHd,
      s3KeyOgg: tracks.s3KeyOgg,
      s3KeyMp3: tracks.s3KeyMp3,
      format: tracks.format,
      formatHd: tracks.formatHd,
    })
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const track = result[0];
  const resolved = resolveTrackAudioSource(track, { hd });
  if (!resolved || !resolved.s3Key) {
    return NextResponse.json({ error: "No audio available" }, { status: 404 });
  }

  const { s3Key, format: fmt } = resolved;

  try {
    // Get audio from cache (streams from S3 and caches in the background on first request)
    const contentType = getContentType(fmt);
    const rangeHeader = request.headers.get("range");

    const cachedOnDisk = isCached(s3Key, fmt);

    // Two range requests must not go through the cache fill, because it can
    // only serve from byte 0: a tiny leading probe (`bytes=0-0` — the player's
    // source badge, and Safari's codec check) and a seek into a track that
    // isn't cached yet. Both used to start a complete S3 download only to
    // throw most of it away — for the probe right next to the <audio>
    // element's own request, which doubled bandwidth exactly when playback
    // started. Proxy just the requested bytes; a from-byte-0 play still fills
    // the cache via the tee below.
    const rangeParts = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader ?? "");
    const rangeStart = rangeParts?.[1] ? parseInt(rangeParts[1], 10) : null;
    const rangeEnd = rangeParts?.[2] ? parseInt(rangeParts[2], 10) : null;
    const isTinyProbe = rangeStart === 0 && rangeEnd !== null && rangeEnd <= 65535;
    const isForwardSeek = rangeStart !== null && rangeStart > 0;

    if (!cachedOnDisk && (isTinyProbe || isForwardSeek)) {
      const presignedUrl = await getPresignedUrl(s3Key);
      const ranged = await fetch(presignedUrl, { headers: { Range: rangeHeader as string } });
      if (ranged.ok && ranged.body) {
        const rangedLength = ranged.headers.get("content-length");
        const rangedContentRange = ranged.headers.get("content-range");
        return new NextResponse(ranged.body, {
          status: ranged.status === 206 ? 206 : 200,
          headers: {
            "Content-Type": ranged.headers.get("content-type") || contentType,
            ...(rangedLength ? { "Content-Length": rangedLength } : {}),
            ...(rangedContentRange ? { "Content-Range": rangedContentRange } : {}),
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, max-age=31536000, immutable",
            "x-melodiq-audio-source": "s3",
            "x-melodiq-audio-cache-state": "miss",
          },
        });
      }
      // S3 didn't cooperate — fall through to the normal cache path.
    }

    const { filePath, stream, cached, size } = await getCachedAudioStream(s3Key, fmt);
    const cacheState = cached ? "hit" : "miss";

    // Without a known byte length a Range response would be built on garbage
    // (Content-Range "bytes 0--1/0"), which the browser reports as a broken
    // stream. Hand off to the direct-S3 fallback in the catch below instead.
    if (!Number.isFinite(size) || size <= 0) {
      stream.destroy();
      throw new Error(`Unknown audio size for ${s3Key}`);
    }

    // Handle range requests for seeking support
    const fileSize = size;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      if (!cached) {
        // The disk copy is still being written in the background by the
        // tee'd branch inside getCachedAudioStream — `stream` here is the
        // other (client-side) branch of that same tee, already reading from
        // S3. Reuse it instead of discarding it and firing a second,
        // separate presigned-URL fetch, which used to skip the disk cache
        // entirely for range requests. There's no true byte-range support on
        // this from-byte-0 branch, so slice out just the requested range for
        // the client while the underlying stream keeps flowing to disk.
        let bytesEmitted = 0;
        let clientDone = false;
        const readable = new ReadableStream({
          start(controller) {
            stream.on("data", (chunk: Buffer) => {
              if (clientDone) return;
              const chunkStart = bytesEmitted;
              bytesEmitted += chunk.length;
              const chunkEnd = bytesEmitted; // exclusive

              if (chunkEnd > start && chunkStart <= end) {
                const sliceStart = Math.max(0, start - chunkStart);
                const sliceEnd = Math.min(chunk.length, end - chunkStart + 1);
                controller.enqueue(chunk.subarray(sliceStart, sliceEnd));
              }

              if (bytesEmitted > end && !clientDone) {
                clientDone = true;
                controller.close();
                stream.destroy(); // tears down only this tee branch — the disk-side branch keeps writing independently
              }
            });
            stream.on("end", () => {
              if (!clientDone) controller.close();
            });
            stream.on("error", (err) => {
              if (!clientDone) controller.error(err);
            });
          },
          cancel() {
            stream.destroy();
          },
        });

        return new NextResponse(readable, {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(chunkSize),
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, max-age=31536000, immutable",
            "x-melodiq-audio-source": "s3",
            "x-melodiq-audio-cache-state": "miss",
          },
        });
      }

      // Cached: the full-file stream from getCachedAudioStream isn't needed
      // for a range request straight from disk.
      stream.destroy();
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
          "Cache-Control": "private, max-age=31536000, immutable",
          "x-melodiq-audio-source": "cache",
          "x-melodiq-audio-cache-state": cacheState,
        },
      });
    }

    // Full file response
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
        "Cache-Control": "private, max-age=31536000, immutable",
        "x-melodiq-audio-source": "cache",
        "x-melodiq-audio-cache-state": cacheState,
      },
    });
  } catch (error) {
    console.error("Audio cache error, falling back to direct S3 stream:", error);

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
          "Cache-Control": "private, max-age=300",
          "x-melodiq-audio-source": "s3",
          "x-melodiq-audio-cache-state": "fallback",
        },
      });
    } catch (fallbackError) {
      console.error("Direct S3 stream fallback failed:", fallbackError);
      return NextResponse.json({ error: "Failed to stream audio" }, { status: 502 });
    }
  }
}
