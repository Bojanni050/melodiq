import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { tracks, workspaces } from "@/db/schema";

const DEFAULT_WORKSPACE_NAME = "Default Workspace";

export type WorkspaceWithTrackIds = {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: string;
  folderGradient?: string;
  isDefault?: boolean;
  parentWorkspaceId?: string | null;
};

export async function ensureDefaultWorkspaceForUser(userId: string) {
  const existing = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.userId, userId), eq(workspaces.isDefault, true)))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const inserted = await db
    .insert(workspaces)
    .values({
      id: randomUUID(),
      userId,
      name: DEFAULT_WORKSPACE_NAME,
      isDefault: true,
      parentWorkspaceId: null,
    })
    .returning();

  return inserted[0];
}

export async function getUserWorkspacesWithTrackIds(
  userId: string,
  knownTracks?: Array<{ id: string; workspaceId: string | null }>
): Promise<WorkspaceWithTrackIds[]> {
  const defaultWorkspace = await ensureDefaultWorkspaceForUser(userId);

  const workspaceRows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.userId, userId))
    .orderBy(asc(workspaces.createdAt));

  const normalizedWorkspaces = workspaceRows.length > 0 ? workspaceRows : [defaultWorkspace];
  const workspaceIds = new Set(normalizedWorkspaces.map((workspace) => workspace.id));

  const trackRows =
    knownTracks ||
    (await db
      .select({ id: tracks.id, workspaceId: tracks.workspaceId })
      .from(tracks)
      .where(eq(tracks.userId, userId)));

  const trackIdsByWorkspace = new Map<string, string[]>();

  normalizedWorkspaces.forEach((workspace) => {
    trackIdsByWorkspace.set(workspace.id, []);
  });

  trackRows.forEach((track) => {
    const targetWorkspaceId =
      track.workspaceId && workspaceIds.has(track.workspaceId)
        ? track.workspaceId
        : defaultWorkspace.id;

    const workspaceTrackIds = trackIdsByWorkspace.get(targetWorkspaceId);
    if (workspaceTrackIds) {
      workspaceTrackIds.push(track.id);
    } else {
      trackIdsByWorkspace.set(targetWorkspaceId, [track.id]);
    }
  });

  return normalizedWorkspaces.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    trackIds: trackIdsByWorkspace.get(workspace.id) || [],
    createdAt: workspace.createdAt.toISOString(),
    folderGradient: workspace.folderGradient || undefined,
    isDefault: workspace.isDefault,
    parentWorkspaceId: workspace.parentWorkspaceId,
  }));
}
