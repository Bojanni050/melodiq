import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { getUserWorkspacesWithTrackIds } from "@/lib/workspaces";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const payload = await getUserWorkspacesWithTrackIds(auth.userId);
  return NextResponse.json({ workspaces: payload });
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
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 });
    }

    const existingWorkspaces = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.userId, auth.userId));

    const existingByName = existingWorkspaces.find(
      (workspace) => workspace.name.trim().toLowerCase() === normalizedName
    );

    if (existingByName) {
      return NextResponse.json({
        workspace: {
          id: existingByName.id,
          name: existingByName.name,
          trackIds: [],
          createdAt: existingByName.createdAt.toISOString(),
          folderGradient: existingByName.folderGradient || undefined,
          isDefault: existingByName.isDefault,
          parentWorkspaceId: existingByName.parentWorkspaceId,
        },
        merged: true,
      });
    }

    const parentWorkspaceId =
      typeof body?.parentWorkspaceId === "string" && body.parentWorkspaceId.trim()
        ? body.parentWorkspaceId.trim()
        : null;

    if (parentWorkspaceId) {
      const parent = await db
        .select()
        .from(workspaces)
        .where(and(eq(workspaces.id, parentWorkspaceId), eq(workspaces.userId, auth.userId)))
        .limit(1);

      if (!parent[0]) {
        return NextResponse.json({ error: "Parent workspace not found" }, { status: 404 });
      }

      if (parent[0].parentWorkspaceId) {
        return NextResponse.json(
          { error: "Only one folder level is allowed (workspace > folder)." },
          { status: 400 }
        );
      }
    }

    const id = typeof body?.id === "string" && body.id.trim() ? body.id.trim() : randomUUID();
    const folderGradient =
      typeof body?.folderGradient === "string" && body.folderGradient.trim()
        ? body.folderGradient.trim()
        : null;

    const inserted = await db
      .insert(workspaces)
      .values({
        id,
        userId: auth.userId,
        name,
        parentWorkspaceId,
        folderGradient,
        isDefault: false,
      })
      .returning();

    if (!inserted[0]) {
      return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
    }

    return NextResponse.json({
      workspace: {
        id: inserted[0].id,
        name: inserted[0].name,
        trackIds: [],
        createdAt: inserted[0].createdAt.toISOString(),
        folderGradient: inserted[0].folderGradient || undefined,
        isDefault: inserted[0].isDefault,
        parentWorkspaceId: inserted[0].parentWorkspaceId,
      },
    });
  } catch (error) {
    console.error("[workspaces/post]", error);
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }
}
