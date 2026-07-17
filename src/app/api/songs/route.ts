import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { songs, workspaces } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { getUserSongsWithTrackIds } from "@/lib/songs";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const songsList = await getUserSongsWithTrackIds(auth.userId);
  return NextResponse.json({ songs: songsList });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const rawName = typeof body?.name === "string" ? body.name : "";
    const name = rawName.trim();
    const normalizedName = name.toLowerCase();

    if (!name) {
      return NextResponse.json({ error: "Song name is required" }, { status: 400 });
    }

    const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId.trim() : "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const workspace = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, auth.userId)))
      .limit(1);

    if (!workspace[0]) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const existingSongs = await db
      .select()
      .from(songs)
      .where(and(eq(songs.userId, auth.userId), eq(songs.workspaceId, workspaceId)));

    const existingByName = existingSongs.find(
      (song) => (song.title || "").trim().toLowerCase() === normalizedName
    );

    if (existingByName) {
      return NextResponse.json({
        song: {
          id: existingByName.id,
          title: existingByName.title,
          workspaceId,
          trackIds: [],
          folderGradient: existingByName.folderGradient || undefined,
          createdAt: existingByName.createdAt.toISOString(),
        },
        merged: true,
      });
    }

    const folderGradient =
      typeof body?.folderGradient === "string" && body.folderGradient.trim()
        ? body.folderGradient.trim()
        : null;
    const id = typeof body?.id === "string" && body.id.trim() ? body.id.trim() : randomUUID();

    const [inserted] = await db
      .insert(songs)
      .values({
        id,
        userId: auth.userId,
        workspaceId,
        title: name,
        folderGradient,
      })
      .returning();

    if (!inserted) {
      return NextResponse.json({ error: "Failed to create song" }, { status: 500 });
    }

    return NextResponse.json({
      song: {
        id: inserted.id,
        title: inserted.title,
        workspaceId,
        trackIds: [],
        folderGradient: inserted.folderGradient || undefined,
        createdAt: inserted.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[songs/post]", error);
    return NextResponse.json({ error: "Failed to create song" }, { status: 500 });
  }
}
