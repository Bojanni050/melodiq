import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateCoverArt } from "@/lib/providers/cover-art";
import { uploadToS3 } from "@/lib/s3";

/**
 * Genereert cover art en slaat die op in S3. Falen is bewust non-blocking.
 */
export async function generateAndSaveCoverArt(track: {
  id: string;
  userId: string;
  title: string | null;
  prompt: string;
  instrumental: boolean;
}): Promise<void> {
  try {
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

    console.log(`[cover-art] done for track ${track.id}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[cover-art] failed for track ${track.id}:`, message);
  }
}