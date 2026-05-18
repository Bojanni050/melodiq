import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { generateCoverArt } from "@/lib/providers/cover-art";
import { uploadToS3 } from "@/lib/s3";

/**
 * Genereert cover art voor een track, of hergebruikt een bestaande cover als
 * dezelfde gebruiker al een track heeft met dezelfde prompt + titel én een cover.
 *
 * Race condition fix voor multi-song batches (Tempolor/PoYo genereren 2 songs tegelijk):
 * Bij de eerste lookup wordt 8 seconden gewacht als er geen cover gevonden wordt.
 * Dit geeft de "eerste" song in de batch tijd om zijn cover te genereren en op te slaan,
 * zodat de "tweede" song die cover kan hergebruiken in plaats van opnieuw te genereren.
 *
 * Faalt altijd stil — breekt nooit audio delivery.
 */
export async function generateAndSaveCoverArt(track: {
  id: string;
  userId: string;
  title: string | null;
  prompt: string;
  instrumental: boolean;
}): Promise<void> {
  try {
    // Eerste poging: zoek bestaande cover
    let existing = await findExistingCover(track);

    if (!existing) {
      // Geen cover gevonden — wacht 8 seconden en probeer opnieuw.
      // Dit lost de race condition op bij multi-song batches:
      // als een andere song in dezelfde batch al bezig is met genereren,
      // is die cover na 8s waarschijnlijk al in de DB.
      await new Promise((r) => setTimeout(r, 8000));
      existing = await findExistingCover(track);
    }

    if (existing?.s3KeyCover) {
      // Hergebruik bestaande S3 cover — geen nieuwe API call nodig
      await db
        .update(tracks)
        .set({
          s3KeyCover: existing.s3KeyCover,
          coverUrl: `/api/tracks/${track.id}/cover`,
        })
        .where(eq(tracks.id, track.id));

      console.log(`[cover-art] reused existing cover for track ${track.id}`);
      return;
    }

    // Nog steeds geen cover na wachten — genereer nieuw via Pixazo Flux 1 Schnell
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

async function findExistingCover(track: {
  userId: string;
  prompt: string;
  title: string | null;
}): Promise<{ s3KeyCover: string } | null> {
  const result = await db
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

  return result[0]?.s3KeyCover ? { s3KeyCover: result[0].s3KeyCover } : null;
}