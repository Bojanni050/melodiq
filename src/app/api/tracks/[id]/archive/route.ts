import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks, trackStems, trackMasters, releaseTracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { deleteFromS3 } from "@/lib/s3";
import { requireAuth } from "@/lib/require-auth";
import { ensureWorkspaceSchema } from "@/lib/workspaces";
import { checkArchiveGuards } from "@/lib/archive-guards";

// POST — archiveer een track: bewaar alleen de originele mp3 (s3Key), wis de
// HD/WAV-versie, alle stems en alle masters, en verwijder de track uit alle
// nog niet-gepubliceerde releases. Gearchiveerde tracks zijn niet afspeelbaar
// en niet herbruikbaar in releases tot ze expliciet worden hersteld (DELETE).
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await ensureWorkspaceSchema();
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

  try {
    const guard = await checkArchiveGuards(id, userId);
    if (guard.blocked) {
      return NextResponse.json(
        { error: guard.message, reason: guard.reason },
        { status: 409 }
      );
    }

    // 1. Stems — S3-bestanden wissen, daarna de rijen verwijderen.
    const stems = await db
      .select({ s3Key: trackStems.s3Key })
      .from(trackStems)
      .where(eq(trackStems.trackId, id));

    await Promise.allSettled(
      stems
        .map((s) => s.s3Key)
        .filter((key): key is string => Boolean(key))
        .map((key) => deleteFromS3(key))
    );
    await db.delete(trackStems).where(eq(trackStems.trackId, id));

    // 2. Masters — zelfde patroon.
    const masters = await db
      .select({ s3Key: trackMasters.s3Key })
      .from(trackMasters)
      .where(eq(trackMasters.trackId, id));

    await Promise.allSettled(
      masters
        .map((m) => m.s3Key)
        .filter((key): key is string => Boolean(key))
        .map((key) => deleteFromS3(key))
    );
    await db.delete(trackMasters).where(eq(trackMasters.trackId, id));

    // 3. HD/WAV-versie van de track zelf.
    const track = result[0];
    if (track.s3KeyHd) {
      await deleteFromS3(track.s3KeyHd).catch((err: any) =>
        console.error(`[archive] failed to delete HD s3 key for track ${id}:`, err?.message ?? err)
      );
    }

    // 4. Track verwijderen uit alle lopende (ongepubliceerde) releases.
    await db.delete(releaseTracks).where(eq(releaseTracks.trackId, id));

    // 5. Track markeren als gearchiveerd. Alleen s3Key/audioUrl blijft staan
    //    als bewaarde mp3; s3KeyHd/audioUrlHd/formatHd worden gewist. Overige
    //    velden (s3Key, audioUrl, trackDna, audioDna, advancedDna, lyrics,
    //    prompt, ...) blijven ongemoeid.
    await db
      .update(tracks)
      .set({
        archivedAt: new Date(),
        s3KeyHd: null,
        audioUrlHd: null,
        formatHd: null,
      })
      .where(eq(tracks.id, id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`[archive] failed to archive track ${id}:`, error?.message ?? error);
    return NextResponse.json({ error: "Failed to archive track" }, { status: 500 });
  }
}

// DELETE — herstel een track uit het archief. archivedAt wordt op null gezet
// zodat de track weer zichtbaar is in de Library en beschikbaar voor
// releases/playlists. WAV/stems/masters zijn definitief verwijderd bij het
// archiveren en worden hierdoor NIET hersteld — alleen de mp3 was bewaard.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await ensureWorkspaceSchema();
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

  try {
    await db.update(tracks).set({ archivedAt: null }).where(eq(tracks.id, id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`[archive] failed to restore archived track ${id}:`, error?.message ?? error);
    return NextResponse.json({ error: "Failed to restore track" }, { status: 500 });
  }
}