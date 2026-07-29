import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { tracks, workspaces } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const deleteTracks = request.nextUrl.searchParams.get("deleteTracks") === "true";

  try {
    const target = await db
      .select()
      .from(workspaces)
      .where(and(eq(workspaces.id, id), eq(workspaces.userId, auth.userId)))
      .limit(1);

    if (!target[0]) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if (target[0].isDefault) {
      return NextResponse.json({ error: "Default workspace cannot be deleted" }, { status: 400 });
    }

    if (deleteTracks) {
      // Cascades to subfolders too (workspaces.parent_workspace_id is ON DELETE
      // CASCADE), so this catches direct tracks in a root workspace and in any
      // of its subfolders in one pass.
      const childIds = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(and(eq(workspaces.parentWorkspaceId, id), eq(workspaces.userId, auth.userId)));
      const workspaceIds = [id, ...childIds.map((w) => w.id)];

      for (const workspaceId of workspaceIds) {
        await db
          .update(tracks)
          .set({ deletedAt: new Date() })
          .where(and(eq(tracks.workspaceId, workspaceId), eq(tracks.userId, auth.userId)));
      }
    }

    await db
      .delete(workspaces)
      .where(and(eq(workspaces.id, id), eq(workspaces.userId, auth.userId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[workspaces/delete]", error);
    return NextResponse.json({ error: "Failed to delete workspace" }, { status: 500 });
  }
}
