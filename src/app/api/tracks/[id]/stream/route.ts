import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import {
  getCachedAudioStream,
  getContentType,
} from "@/lib/audio-cache";
import fs from "fs";

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
    .select()
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const track = result[0];
  if (!track.s3Key) {
    return NextResponse.json({ error: "No audio available" }, { status: 404 });
  }

  const s3Key = hd && track.s3KeyHd ? track.s3KeyHd : track.s3Key;
  const fmt = hd && track.formatHd ? track.formatHd : track.format ?? "mp3";

  try {
    // Get audio from cache (downloads from S3 on first request)
    const { filePath, stream } = await getCachedAudioStream(s3Key, fmt);
    const stats = fs.statSync(filePath);
    const contentType = getContentType(fmt);

    // Handle range requests for seeking support
    const rangeHeader = request.headers.get("range");
    const fileSize = stats.size;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
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
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Audio cache error:", error);
    return NextResponse.json({ error: "Failed to stream audio" }, { status: 502 });
  }
}
