import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { releaseTracks, releases, tracks } from "@/db/schema";
import { generateAndSaveReleaseCoverArt } from "@/lib/generate-cover";
import { getUserReleaseById, getUserReleasesWithTracks } from "@/lib/releases";
import { requireAuth } from "@/lib/require-auth";

const RELEASE_TYPES = new Set(["single", "ep", "album"]);

function normalizeTrackIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

async function normalizeReleaseOrder(releaseId: string, orderedRows: Array<{ id: string }>) {
  // Phase 1: move current positions away from the target range to avoid unique collisions.
  for (let index = 0; index < orderedRows.length; index += 1) {
    await db
      .update(releaseTracks)
      .set({ position: index + 100000 })
      .where(eq(releaseTracks.id, orderedRows[index].id));
  }

  // Phase 2: assign final contiguous positions.
  for (let index = 0; index < orderedRows.length; index += 1) {
    await db
      .update(releaseTracks)
      .set({ position: index })
      .where(eq(releaseTracks.id, orderedRows[index].id));
  }
}

async function respondWithRelease(userId: string, releaseId: string) {
  const hydrated = await getUserReleasesWithTracks(userId);
  const release = hydrated.find((item) => item.id === releaseId);
  return NextResponse.json({ release });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const existing = await getUserReleaseById(auth.userId, id);
    if (!existing) {
      return NextResponse.json({ error: "Release not found" }, { status: 404 });
    }

    await db.delete(releases).where(and(eq(releases.id, id), eq(releases.userId, auth.userId)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[releases/delete]", error);
    return NextResponse.json({ error: "Failed to delete release" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const existing = await getUserReleaseById(auth.userId, id);
  if (!existing) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const action = typeof body?.action === "string" ? body.action : "";

    if (action === "add-track") {
      const trackId = typeof body?.trackId === "string" ? body.trackId : "";
      const side = typeof body?.side === "string" && body.side.trim() ? body.side.trim().slice(0, 10) : null;
      const allowDuplicate = body?.allowDuplicate === true;

      if (!trackId) {
        return NextResponse.json({ error: "trackId is required" }, { status: 400 });
      }

      const track = await db
        .select({
          id: tracks.id,
          title: tracks.title,
          prompt: tracks.prompt,
          instrumental: tracks.instrumental,
          lyrics: tracks.lyrics,
        })
        .from(tracks)
        .where(and(eq(tracks.id, trackId), eq(tracks.userId, auth.userId)))
        .limit(1);

      if (!track[0]) {
        return NextResponse.json({ error: "Track not found" }, { status: 404 });
      }

      if (!allowDuplicate) {
        const existingTrack = await db
          .select({ id: releaseTracks.id })
          .from(releaseTracks)
          .where(and(eq(releaseTracks.releaseId, id), eq(releaseTracks.trackId, trackId)))
          .limit(1);

        if (existingTrack[0]) {
          return respondWithRelease(auth.userId, id);
        }
      }

      const maxPos = await db
        .select({ value: sql<number>`coalesce(max(${releaseTracks.position}), -1)` })
        .from(releaseTracks)
        .where(eq(releaseTracks.releaseId, id));

      const nextPosition = Number(maxPos[0]?.value ?? -1) + 1;

      await db.insert(releaseTracks).values({
        releaseId: id,
        trackId,
        position: nextPosition,
        side,
      });

      if (nextPosition === 0 && track[0].prompt) {
        // First track added to this release — use it as inspiration for an auto-generated cover.
        // Fire-and-forget: fails silently, response doesn't wait on it.
        generateAndSaveReleaseCoverArt(
          { id, userId: auth.userId },
          {
            title: track[0].title,
            prompt: track[0].prompt,
            instrumental: track[0].instrumental,
            lyrics: track[0].lyrics,
          }
        ).catch((err) => console.error("[releases/add-track] cover generation failed:", err));
      }

      return respondWithRelease(auth.userId, id);
    }

    if (action === "remove-track") {
      const trackId = typeof body?.trackId === "string" ? body.trackId : "";
      if (!trackId) {
        return NextResponse.json({ error: "trackId is required" }, { status: 400 });
      }

      await db
        .delete(releaseTracks)
        .where(and(eq(releaseTracks.releaseId, id), eq(releaseTracks.trackId, trackId)));

      const remaining = await db
        .select({ id: releaseTracks.id })
        .from(releaseTracks)
        .where(eq(releaseTracks.releaseId, id))
        .orderBy(asc(releaseTracks.position), asc(releaseTracks.createdAt));

      await normalizeReleaseOrder(id, remaining);

      return respondWithRelease(auth.userId, id);
    }

    if (action === "reorder-tracks") {
      const orderedTrackIds = normalizeTrackIds(body?.trackIds);

      const currentRows = await db
        .select({ id: releaseTracks.id, trackId: releaseTracks.trackId })
        .from(releaseTracks)
        .where(eq(releaseTracks.releaseId, id))
        .orderBy(asc(releaseTracks.position), asc(releaseTracks.createdAt));

      if (currentRows.length === 0) {
        return respondWithRelease(auth.userId, id);
      }

      const remainingRows = [...currentRows];
      const nextRows: Array<{ id: string; trackId: string }> = [];

      orderedTrackIds.forEach((trackId) => {
        const index = remainingRows.findIndex((row) => row.trackId === trackId);
        if (index < 0) return;
        nextRows.push(remainingRows[index]);
        remainingRows.splice(index, 1);
      });

      nextRows.push(...remainingRows);

      await normalizeReleaseOrder(id, nextRows);

      return respondWithRelease(auth.userId, id);
    }

    if (action === "set-side") {
      const trackId = typeof body?.trackId === "string" ? body.trackId : "";
      const side = typeof body?.side === "string" && body.side.trim() ? body.side.trim().slice(0, 10) : null;
      if (!trackId) {
        return NextResponse.json({ error: "trackId is required" }, { status: 400 });
      }

      await db
        .update(releaseTracks)
        .set({ side })
        .where(and(eq(releaseTracks.releaseId, id), eq(releaseTracks.trackId, trackId)));

      return respondWithRelease(auth.userId, id);
    }

    if (action === "rename") {
      const rawTitle = typeof body?.title === "string" ? body.title : "";
      const title = rawTitle.trim();
      if (!title) {
        return NextResponse.json({ error: "Release title is required" }, { status: 400 });
      }

      await db
        .update(releases)
        .set({ title, updatedAt: new Date() })
        .where(and(eq(releases.id, id), eq(releases.userId, auth.userId)));

      return respondWithRelease(auth.userId, id);
    }

    if (action === "update-type") {
      const type = typeof body?.type === "string" ? body.type : "";
      if (!RELEASE_TYPES.has(type)) {
        return NextResponse.json({ error: "type must be single, ep, or album" }, { status: 400 });
      }

      await db
        .update(releases)
        .set({ type, updatedAt: new Date() })
        .where(and(eq(releases.id, id), eq(releases.userId, auth.userId)));

      return respondWithRelease(auth.userId, id);
    }

    if (action === "update-details") {
      const kind = typeof body?.kind === "string" ? body.kind.trim().slice(0, 30) || null : undefined;
      const artistName = typeof body?.artistName === "string" ? body.artistName.trim().slice(0, 255) || null : undefined;
      const description = typeof body?.description === "string" ? body.description.trim() || null : undefined;
      const releaseDate = typeof body?.releaseDate === "string" && body.releaseDate.trim()
        ? new Date(body.releaseDate)
        : body?.releaseDate === null ? null : undefined;

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (kind !== undefined) updates.kind = kind;
      if (artistName !== undefined) updates.artistName = artistName;
      if (description !== undefined) updates.description = description;
      if (releaseDate !== undefined) updates.releaseDate = releaseDate;

      await db
        .update(releases)
        .set(updates)
        .where(and(eq(releases.id, id), eq(releases.userId, auth.userId)));

      return respondWithRelease(auth.userId, id);
    }

    if (action === "toggle-public") {
      const nextPublic = !existing.isPublic;
      const now = new Date();

      // Cascade: publish or unpublish all tracks that belong to this release.
      const releaseTrackRows = await db
        .select({ trackId: releaseTracks.trackId })
        .from(releaseTracks)
        .where(eq(releaseTracks.releaseId, id));

      const trackIds = releaseTrackRows.map((row) => row.trackId);

      if (trackIds.length > 0) {
        if (nextPublic) {
          // Only publish tracks that aren't already published.
          await db
            .update(tracks)
            .set({ releaseStatus: "published", publishDate: now, updatedAt: now })
            .where(
              and(
                inArray(tracks.id, trackIds),
                eq(tracks.userId, auth.userId),
                sql`${tracks.releaseStatus} != 'published'`
              )
            );
        } else {
          // Unpublish all tracks in the release.
          await db
            .update(tracks)
            .set({ releaseStatus: "unpublished", publishDate: null, updatedAt: now })
            .where(
              and(
                inArray(tracks.id, trackIds),
                eq(tracks.userId, auth.userId)
              )
            );
        }
      }

      await db
        .update(releases)
        .set({
          isPublic: nextPublic,
          publishedAt: nextPublic ? now : null,
          updatedAt: now,
        })
        .where(and(eq(releases.id, id), eq(releases.userId, auth.userId)));

      return respondWithRelease(auth.userId, id);
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("[releases/patch]", error);
    return NextResponse.json({ error: "Failed to update release" }, { status: 500 });
  }
}
