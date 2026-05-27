import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

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

    const children = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.userId, auth.userId), eq(workspaces.parentWorkspaceId, id)));

    const idsToDelete = [id, ...children.map((child) => child.id)];

    await db
      .delete(workspaces)
      .where(and(eq(workspaces.userId, auth.userId), inArray(workspaces.id, idsToDelete)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[workspaces/delete]", error);
    return NextResponse.json({ error: "Failed to delete workspace" }, { status: 500 });
  }
}
