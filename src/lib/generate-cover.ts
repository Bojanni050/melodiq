import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { generateCoverArt } from "@/lib/providers/cover-art";
import { uploadToS3 } from "@/lib/s3";

/**
 * Genereert cover art voor een track, of hergebruikt een bestaande cover als
 * dezelfde gebruiker al een track heeft met dezelfde prompt + titel en een cover.
 * Dekt automatisch Tempolor en PoYo multi-song batches (beide songs delen de cover).
 * Faalt altijd stil - breekt nooit audio delivery.
 */
export async function generateAndSaveCoverArt(track: {
  id: string;
  userId: string;
  title: string | null;
  prompt: string;
  instrumental: boolean;
}): Promise<void> {
  try {
    // Zoek bestaande cover met dezelfde prompt + titel van dezelfde gebruiker
    const existing = await db
      .select({ s3KeyCover: tracks.s3KeyCover })
      .from(tracks)
      .where(
        and(
          eq(tracks.userId, track.userId),
          eq(tracks.prompt, track.prompt),
          eq(tracks.title, track.title ?? ""),
          isNotNull(tracks.s3KeyCover)
        )
      )
      .limit(1);

    if (existing.length > 0 && existing[0].s3KeyCover) {
      // Hergebruik bestaande S3 cover - geen nieuwe API call nodig
      await db
        .update(tracks)
        .set({
          s3KeyCover: existing[0].s3KeyCover,
          coverUrl: `/api/tracks/${track.id}/cover`,
        })
        .where(eq(tracks.id, track.id));

      console.log(
        `[cover-art] reused existing cover for track ${track.id} (same prompt+title)`
      );
      return;
    }

    // Geen bestaande cover - genereer nieuw via Pixazo Flux 1 Schnell
    const imageBuffer = await generateCoverArt({
      prompt: track.prompt,
      title: track.title || "Untitled",
      instrumental: track.instrumental,
    });

    const s3KeyCover = `tracks/${track.id}/cover.jpg`;
    await uploadToS3(s3KeyCover, imageBuffer, "image/jpeg");

    await db
      .update(tracks)
      .set({
        s3KeyCover,
        coverUrl: `/api/tracks/${track.id}/cover`,
      })
      .where(eq(tracks.id, track.id));

    console.log(`[cover-art] generated new cover for track ${track.id}`);
  } catch (error: any) {
    console.warn(
      `[cover-art] failed for track ${track.id}:`,
      error?.message ?? error
    );
  }
}