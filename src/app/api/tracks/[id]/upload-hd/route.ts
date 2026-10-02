import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { uploadToS3 } from "@/lib/s3";
import { contentTypeForFormat } from "@/lib/audio-format";
import { detectUploadFormat } from "@/app/api/tracks/upload-helpers";

const MAX_HD_UPLOAD_BYTES = 200 * 1024 * 1024;

/**
 * POST /api/tracks/[id]/upload-hd
 *
 * Voegt handmatig een lossless (WAV/FLAC) versie toe aan een track die nog
 * geen HD-bestand heeft (geen s3KeyHd). Multipart FormData met één veld:
 * `file`. Alleen WAV en FLAC worden geaccepteerd — MP3/OGG hebben als HD
 * geen zin omdat ze lossy zijn.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Could not read upload form data. Please reselect the file and try again." },
      { status: 400 }
    );
  }

  const entry = formData.get("file");
  if (!(entry instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (entry.size === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 });
  }

  if (entry.size > MAX_HD_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Upload is too large. Current server limit is 200MB." },
      { status: 413 }
    );
  }

  const format = detectUploadFormat(entry);
  if (format !== "wav" && format !== "flac") {
    return NextResponse.json(
      { error: "Only WAV or FLAC files can be added as HD version." },
      { status: 400 }
    );
  }

  try {
    const audioBuffer = Buffer.from(await entry.arrayBuffer());
    const s3KeyHd = `tracks/${track.id}/audio_hd.${format}`;
    await uploadToS3(s3KeyHd, audioBuffer, contentTypeForFormat(format));

    await db
      .update(tracks)
      .set({
        s3KeyHd,
        formatHd: format,
        audioUrlHd: `/api/tracks/${track.id}/download?hd=true`,
        updatedAt: new Date(),
      })
      .where(eq(tracks.id, track.id));

    return NextResponse.json({
      success: true,
      trackId: track.id,
      s3KeyHd,
      formatHd: format,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[upload-hd] failed for track ${id}:`, message);
    return NextResponse.json(
      { error: "Failed to upload HD version" },
      { status: 500 }
    );
  }
}
