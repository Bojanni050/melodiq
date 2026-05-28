import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { generateCoverArt } from "@/lib/providers/cover-art";
import { uploadToS3 } from "@/lib/s3";

/**
 * Genereert cover art voor een enkele track (Lyria, MiniMax, MusicGPT).
 * Hergebruikt een bestaande cover als dezelfde prompt al eerder gebruikt werd.
 * Faalt altijd stil.
 */
export async function generateAndSaveCoverArt(track: {
  id: string;
  userId: string;
  title: string | null;
  prompt: string;
  instrumental: boolean;
}, options?: { forceNew?: boolean }): Promise<void> {
  try {
    const shouldReuse = !options?.forceNew;
    const existing = shouldReuse
      ? await findExistingCover({
          userId: track.userId,
          prompt: track.prompt,
        })
      : null;

    if (existing?.s3KeyCover) {
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
    console.warn(`[cover-art] failed for track ${track.id}:`, error?.message ?? error);
  }
}

/**
 * Genereert één cover art voor een batch tracks (PoYo/Tempolor multi-song).
 * Wordt direct aangeroepen vanuit de generate route, parallel aan audio generatie.
 * Wijst de cover toe aan ALLE tracks in de batch tegelijk.
 * Hergebruikt een bestaande cover als dezelfde prompt al eerder gebruikt werd.
 * Faalt altijd stil.
 */
export async function generateAndSaveCoverArtForBatch(batch: {
  tracks: Array<{
    id: string;
    userId: string;
    prompt: string;
    title: string | null;
    instrumental: boolean;
  }>;
}, options?: { forceNew?: boolean }): Promise<void> {
  if (batch.tracks.length === 0) return;

  const primary = batch.tracks[0];

  try {
    let s3KeyCover: string;

    const existing = options?.forceNew
      ? null
      : await findExistingCover({
          userId: primary.userId,
          prompt: primary.prompt,
        });

    if (existing?.s3KeyCover) {
      s3KeyCover = existing.s3KeyCover;
      console.log(`[cover-art] reusing existing cover for batch of ${batch.tracks.length}`);
    } else {
      const imageBuffer = await generateCoverArt({
        prompt: primary.prompt,
        title: primary.title || "Untitled",
        instrumental: primary.instrumental,
      });

      // Sla op onder de eerste track ID als canonical S3 key
      s3KeyCover = `tracks/${primary.id}/cover.jpg`;
      await uploadToS3(s3KeyCover, imageBuffer, "image/jpeg");
      console.log(`[cover-art] generated new cover for batch of ${batch.tracks.length}`);
    }

    // Wijs cover toe aan alle tracks in de batch
    await Promise.all(
      batch.tracks.map((t) =>
        db
          .update(tracks)
          .set({
            s3KeyCover,
            coverUrl: `/api/tracks/${t.id}/cover`,
          })
          .where(eq(tracks.id, t.id))
      )
    );
  } catch (error: any) {
    console.warn(`[cover-art] batch failed:`, error?.message ?? error);
  }
}

async function findExistingCover(track: {
  userId: string;
  prompt: string;
}): Promise<{ s3KeyCover: string } | null> {
  const result = await db
    .select({ s3KeyCover: tracks.s3KeyCover })
    .from(tracks)
    .where(
      and(
        eq(tracks.userId, track.userId),
        eq(tracks.prompt, track.prompt),
        isNotNull(tracks.s3KeyCover)
      )
    )
    .limit(1);

  return result[0]?.s3KeyCover ? { s3KeyCover: result[0].s3KeyCover } : null;
}
